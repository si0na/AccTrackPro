import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  runBulkValidate,
  BulkValidationResult,
} from '../../common/utils/bulk-validate.util';
import {
  runBulkImport,
  BulkImportOutcome,
  BulkRowResult,
  DuplicateMode,
} from '../../common/utils/bulk-import.util';
import {
  IEModuleKey,
  MODULE_ORDER,
  FIELDS_BY_MODULE,
} from './import-field-schemas';
import {
  BulkModuleAdapter,
  isPendingId,
  parsePendingId,
  pendingAccountId,
  pendingOpportunityId,
  pendingStakeholderId,
  norm,
} from './bulk-adapter';
import { ImportExportAuditService } from './import-export-audit.service';
import { AccountsService } from '../accounts/accounts.service';
import { StakeholdersService } from '../stakeholders/stakeholders.service';
import { OpportunitiesService } from '../opportunities/opportunities.service';
import { ActionItemsService } from '../action-items/action-items.service';

/** One worksheet's parsed contents (client parses the .xlsx; backend validates). */
export interface WorkbookSheet {
  rows: Record<string, any>[];
  headers: string[];
}
export type WorkbookSheets = Partial<Record<IEModuleKey, WorkbookSheet>>;
export type WorkbookValidation = Partial<Record<IEModuleKey, BulkValidationResult>>;
/** Kept-row payloads per module, sent back for the commit after preview. */
export type WorkbookImportRequest = Partial<Record<IEModuleKey, Record<string, any>[]>>;
export type WorkbookImportResult = Partial<Record<IEModuleKey, BulkImportOutcome>>;

interface ParentRef {
  id: string;
  name: string;
}

/**
 * Unifies the two sources a cross-sheet parent reference can resolve against:
 * records that already exist in the system (owner-scoped, real ids), and
 * parents defined earlier in the SAME workbook (pending, marker ids). Existing
 * records win — a name that already exists is never treated as a new parent.
 */
class ParentIndex {
  private readonly accByName = new Map<string, ParentRef>();
  private readonly accById = new Map<string, ParentRef>();
  private readonly pendingAcc = new Map<string, ParentRef>();
  private readonly oppByKey = new Map<string, ParentRef>(); // `${accountId}::${lcName}`
  private readonly oppById = new Map<string, ParentRef & { accountId: string }>();
  private readonly pendingOpp = new Map<string, ParentRef>(); // `${accountId}::${lcName}`
  private readonly stkByKey = new Map<string, ParentRef>(); // `${accountId}::${lcName}`
  private readonly stkById = new Map<string, ParentRef & { accountId: string }>();
  private readonly pendingStk = new Map<string, ParentRef>(); // `${accountId}::${lcName}`

  seedAccount(id: string, name: string): void {
    const ref = { id, name };
    this.accByName.set(norm(name), ref);
    this.accById.set(id, ref);
  }
  seedOpportunity(id: string, name: string, accountId: string): void {
    this.oppByKey.set(`${accountId}::${norm(name)}`, { id, name });
    this.oppById.set(id, { id, name, accountId });
  }
  seedStakeholder(id: string, name: string, accountId: string): void {
    this.stkByKey.set(`${accountId}::${norm(name)}`, { id, name });
    this.stkById.set(id, { id, name, accountId });
  }

  /** A NEW account defined in the workbook — resolves to a marker until committed. */
  addPendingAccount(name: string): void {
    if (this.accByName.has(norm(name)) || this.pendingAcc.has(norm(name))) return;
    this.pendingAcc.set(norm(name), { id: pendingAccountId(name), name });
  }
  /** A NEW opportunity defined in the workbook, under a (real or pending) account. */
  addPendingOpportunity(name: string, accountId: string): void {
    const key = `${accountId}::${norm(name)}`;
    if (this.oppByKey.has(key) || this.pendingOpp.has(key)) return;
    this.pendingOpp.set(key, { id: pendingOpportunityId(name), name });
  }
  /** A NEW stakeholder defined in the workbook, under a (real or pending) account. */
  addPendingStakeholder(name: string, accountId: string): void {
    const key = `${accountId}::${norm(name)}`;
    if (this.stkByKey.has(key) || this.pendingStk.has(key)) return;
    this.pendingStk.set(key, { id: pendingStakeholderId(name), name });
  }

  resolveAccount(raw: string): ParentRef | null {
    const lc = norm(raw);
    return this.accByName.get(lc) ?? this.accById.get(raw.trim()) ?? this.pendingAcc.get(lc) ?? null;
  }
  resolveOpportunity(raw: string, accountId: string): ParentRef | null {
    const lc = norm(raw);
    const key = `${accountId}::${lc}`;
    if (this.oppByKey.has(key)) return this.oppByKey.get(key)!;
    if (this.pendingOpp.has(key)) return this.pendingOpp.get(key)!;
    const byId = this.oppById.get(raw.trim());
    if (byId && byId.accountId === accountId) return byId;
    return null;
  }
  resolveStakeholder(raw: string, accountId: string): ParentRef | null {
    const lc = norm(raw);
    const key = `${accountId}::${lc}`;
    if (this.stkByKey.has(key)) return this.stkByKey.get(key)!;
    if (this.pendingStk.has(key)) return this.pendingStk.get(key)!;
    const byId = this.stkById.get(raw.trim());
    if (byId && byId.accountId === accountId) return byId;
    return null;
  }
}

/**
 * Orchestrates the single-workbook Global Import/Export across the four CRM
 * modules. Worksheets are always processed in dependency order
 * (accounts → stakeholders → opportunities → action items) regardless of their
 * order in the file, so a parent is validated/created before the children that
 * reference it. Every record is written through its own module service, so all
 * existing business logic (uniqueness, custom_data, notifications, activity)
 * runs per row; this service only adds cross-sheet reference resolution and the
 * run-level audit.
 */
@Injectable()
export class GlobalImportExportService {
  private readonly logger = new Logger(GlobalImportExportService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly audit: ImportExportAuditService,
    private readonly accounts: AccountsService,
    private readonly stakeholders: StakeholdersService,
    private readonly opportunities: OpportunitiesService,
    private readonly actionItems: ActionItemsService,
  ) {}

  private adapterFor(module: IEModuleKey, userId: string): BulkModuleAdapter {
    switch (module) {
      case 'accounts':      return this.accounts.bulkAdapter(userId);
      case 'stakeholders':  return this.stakeholders.bulkAdapter(userId);
      case 'opportunities': return this.opportunities.bulkAdapter(userId);
      case 'actionItems':   return this.actionItems.bulkAdapter(userId);
    }
  }

  // ── Validation (dry run) ────────────────────────────────────────────────────

  /**
   * Validates every populated worksheet and returns a per-module verdict map.
   * References resolve against existing owner-scoped records PLUS parents defined
   * earlier in the same workbook; an unresolved parent marks the row invalid
   * (parents are never auto-created).
   */
  async validateWorkbook(sheets: WorkbookSheets, userId: string): Promise<WorkbookValidation> {
    const parents = await this.loadParentIndex(userId);
    const result: WorkbookValidation = {};

    for (const module of MODULE_ORDER) {
      const sheet = sheets[module];
      if (!sheet || !sheet.rows?.length) continue;

      const adapter = this.adapterFor(module, userId);
      const validation = await runBulkValidate(sheet.rows, sheet.headers ?? [], {
        fields: adapter.fields,
        resolveReferences: this.buildResolver(module, parents),
        postValidate: adapter.postValidate,
        validate: adapter.validate,
        naturalKey: adapter.naturalKey,
        findExistingId: adapter.findExistingId,
      });
      result[module] = validation;
      this.registerPendingParents(module, validation, parents);
    }
    return result;
  }

  /** Central reference resolver — same rules for every module, driven by the schema. */
  private buildResolver(module: IEModuleKey, parents: ParentIndex) {
    const refFields = FIELDS_BY_MODULE[module].filter((f) => f.type === 'reference');
    return async (payload: Record<string, any>) => {
      const errors: string[] = [];
      const refNames: Record<string, string> = {};
      let resolvedAccountId: string | undefined;

      for (const f of refFields) {
        const raw = String(payload[f.key] ?? '').trim();
        if (f.reference === 'account') {
          if (!raw) continue; // required-ness already enforced by field coercion
          const acc = parents.resolveAccount(raw);
          if (!acc) {
            errors.push(`Account "${raw}" was not found — add it to the Accounts sheet or ensure it already exists`);
            continue;
          }
          payload[f.key] = acc.id;
          resolvedAccountId = acc.id;
          refNames.account = acc.name;
        } else if (f.reference === 'opportunity') {
          if (!raw) continue; // optional
          if (!resolvedAccountId) continue; // account error already reported
          const opp = parents.resolveOpportunity(raw, resolvedAccountId);
          if (!opp) {
            errors.push(`Opportunity "${raw}" was not found for this account`);
            continue;
          }
          payload[f.key] = opp.id;
          refNames.opportunity = opp.name;
        } else if (f.reference === 'stakeholder') {
          if (!raw) continue; // required-ness already enforced by field coercion
          if (!resolvedAccountId) continue; // account error already reported
          const stk = parents.resolveStakeholder(raw, resolvedAccountId);
          if (!stk) {
            errors.push(`Stakeholder "${raw}" was not found for this account — add it to the Stakeholders sheet or ensure it already exists`);
            continue;
          }
          payload[f.key] = stk.id;
          refNames.stakeholder = stk.name;
        }
      }
      return { errors, refNames };
    };
  }

  /**
   * After a sheet is validated, register the rows that WILL be created as pending
   * parents so later sheets can reference them. Rows that already exist in the
   * system resolve against the real DB record instead and are not registered.
   */
  private registerPendingParents(
    module: IEModuleKey,
    validation: BulkValidationResult,
    parents: ParentIndex,
  ): void {
    if (module !== 'accounts' && module !== 'opportunities' && module !== 'stakeholders') return;
    for (const row of validation.rows) {
      if (row.status === 'invalid' || row.existsInSystem) continue;
      if (module === 'accounts') {
        if (row.payload.name) parents.addPendingAccount(String(row.payload.name));
      } else if (module === 'opportunities') {
        if (row.payload.name && row.payload.accountId) {
          parents.addPendingOpportunity(String(row.payload.name), String(row.payload.accountId));
        }
      } else if (module === 'stakeholders') {
        if (row.payload.name && row.payload.accountId) {
          parents.addPendingStakeholder(String(row.payload.name), String(row.payload.accountId));
        }
      }
    }
  }

  // ── Commit ──────────────────────────────────────────────────────────────────

  /**
   * Commits the kept rows in dependency order. Pending parent markers are
   * swapped for the real ids created earlier in this run; a row whose parent was
   * removed in the preview (or failed to import) is failed with a clear message.
   */
  async importWorkbook(
    request: WorkbookImportRequest,
    duplicateMode: DuplicateMode,
    userId: string,
    userName?: string,
  ): Promise<WorkbookImportResult> {
    const committedAccounts = new Map<string, string>(); // lcName -> real id
    const committedOpps = new Map<string, string>();      // `${accountId}::${lcName}` -> real id
    const committedStakeholders = new Map<string, string>(); // `${accountId}::${lcName}` -> real id
    const results: WorkbookImportResult = {};

    for (const module of MODULE_ORDER) {
      const rows = request[module];
      if (!rows || !rows.length) continue;
      const adapter = this.adapterFor(module, userId);

      // Resolve pending markers; split resolvable rows from ones whose parent is gone.
      const prepared: { payload: Record<string, any>; originalIndex: number }[] = [];
      const preFailures: BulkRowResult[] = [];
      rows.forEach((payload, index) => {
        const err = this.resolveMarkers(module, payload, committedAccounts, committedOpps, committedStakeholders);
        if (err) preFailures.push({ index, status: 'failed', message: err });
        else prepared.push({ payload, originalIndex: index });
      });

      const outcome = await runBulkImport(prepared.map((p) => p.payload), {
        duplicateMode,
        validate: adapter.validate,
        findDuplicateId: adapter.findExistingId,
        create: adapter.create,
        update: adapter.update,
      });

      // Register newly created/updated parents for downstream sheets.
      for (const r of outcome.results) {
        if ((r.status !== 'created' && r.status !== 'updated') || !r.id) continue;
        const payload = prepared[r.index].payload;
        if (module === 'accounts') {
          committedAccounts.set(norm(payload.name), r.id);
        } else if (module === 'opportunities') {
          committedOpps.set(`${payload.accountId}::${norm(payload.name)}`, r.id);
        } else if (module === 'stakeholders') {
          committedStakeholders.set(`${payload.accountId}::${norm(payload.name)}`, r.id);
        }
      }

      results[module] = this.mergeOutcome(rows.length, outcome, prepared, preFailures);
    }

    await this.audit.recordImportRun({ userId, userName, results });
    return results;
  }

  /** Swaps PENDING markers for committed ids in place; returns an error message or null. */
  private resolveMarkers(
    module: IEModuleKey,
    payload: Record<string, any>,
    accounts: Map<string, string>,
    opps: Map<string, string>,
    stakeholders: Map<string, string>,
  ): string | null {
    const fields = FIELDS_BY_MODULE[module];
    const accField = fields.find((f) => f.reference === 'account');
    if (accField && isPendingId(payload[accField.key])) {
      const { name } = parsePendingId(payload[accField.key]);
      const id = accounts.get(name);
      if (!id) return `Referenced account was not imported (it may have been removed or failed to import)`;
      payload[accField.key] = id;
    }
    const oppField = fields.find((f) => f.reference === 'opportunity');
    if (oppField && isPendingId(payload[oppField.key])) {
      const { name } = parsePendingId(payload[oppField.key]);
      const accountId = accField ? payload[accField.key] : undefined;
      const id = accountId ? opps.get(`${accountId}::${name}`) : undefined;
      if (!id) return `Referenced opportunity was not imported (it may have been removed or failed to import)`;
      payload[oppField.key] = id;
    }
    const stkField = fields.find((f) => f.reference === 'stakeholder');
    if (stkField && isPendingId(payload[stkField.key])) {
      const { name } = parsePendingId(payload[stkField.key]);
      const accountId = accField ? payload[accField.key] : undefined;
      const id = accountId ? stakeholders.get(`${accountId}::${name}`) : undefined;
      if (!id) return `Referenced stakeholder was not imported (it may have been removed or failed to import)`;
      payload[stkField.key] = id;
    }
    return null;
  }

  /** Merges the runBulkImport outcome with the pre-import parent-resolution failures. */
  private mergeOutcome(
    total: number,
    outcome: BulkImportOutcome,
    prepared: { originalIndex: number }[],
    preFailures: BulkRowResult[],
  ): BulkImportOutcome {
    const remapped = outcome.results.map((r) => ({
      ...r,
      index: prepared[r.index]?.originalIndex ?? r.index,
    }));
    const results = [...remapped, ...preFailures].sort((a, b) => a.index - b.index);
    return {
      total,
      created: outcome.created,
      updated: outcome.updated,
      skipped: outcome.skipped,
      failed: outcome.failed + preFailures.length,
      results,
    };
  }

  // ── Shared ────────────────────────────────────────────────────────────────

  private async loadParentIndex(userId: string): Promise<ParentIndex> {
    const index = new ParentIndex();
    const accRes = await this.db.query(
      `SELECT id, name FROM accounts WHERE is_deleted = FALSE
       AND ($1::TEXT IS NULL OR owner_id = $1)`,
      [userId ?? null],
    );
    for (const r of accRes.rows) index.seedAccount(r.id, r.name);

    const oppRes = await this.db.query(
      `SELECT id, name, account_id FROM opportunities WHERE is_deleted = FALSE
       AND ($1::TEXT IS NULL OR owner_id = $1)`,
      [userId ?? null],
    );
    for (const r of oppRes.rows) index.seedOpportunity(r.id, r.name, r.account_id);

    const stkRes = await this.db.query(
      `SELECT s.id, s.name, s.account_id FROM stakeholders s
       INNER JOIN accounts a ON s.account_id = a.id
       WHERE s.is_deleted = FALSE AND a.is_deleted = FALSE
       AND ($1::TEXT IS NULL OR a.owner_id = $1)`,
      [userId ?? null],
    );
    for (const r of stkRes.rows) index.seedStakeholder(r.id, r.name, r.account_id);
    return index;
  }
}
