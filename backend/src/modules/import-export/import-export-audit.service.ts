import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { BulkImportOutcome } from '../../common/utils/bulk-import.util';

export type ImportExportModule = 'accounts' | 'opportunities' | 'stakeholders' | 'actionItems';

const MODULE_LABEL: Record<string, string> = {
  accounts: 'Accounts',
  opportunities: 'Opportunities',
  stakeholders: 'Stakeholders',
  actionItems: 'Action Items',
};

/**
 * Writes the Import/Export audit trail. Every bulk import and every export is
 * recorded both in the dedicated `import_export_audit` table (with per-run
 * record counts and outcome status) and as a `general` entry in the append-only
 * `activities` feed so it surfaces in Recent Activity alongside other mutations.
 *
 * Audit writes are best-effort: a logging failure is recorded but never blocks
 * the underlying import/export from completing.
 */
@Injectable()
export class ImportExportAuditService {
  private readonly logger = new Logger(ImportExportAuditService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Records a Global Import run: one `import_export_audit` row per module that
   * was processed (with its created/updated/skipped/failed counts) plus a single
   * combined `activities` entry summarising the whole workbook.
   */
  async recordImportRun(params: {
    userId?: string;
    userName?: string;
    results: Record<string, BulkImportOutcome>;
  }): Promise<void> {
    const { userId, userName, results } = params;
    const modules = Object.keys(results);
    if (modules.length === 0) return;

    try {
      const parts: string[] = [];
      for (const module of modules) {
        const outcome = results[module];
        const processed = outcome.created + outcome.updated;
        const status = outcome.failed === 0 ? 'success' : processed > 0 ? 'partial' : 'failed';
        const label = MODULE_LABEL[module] ?? module;
        await this.db.query(
          `INSERT INTO import_export_audit
             (id, user_id, user_name, module, action, file_format,
              total_records, created_records, updated_records, skipped_records, failed_records, status)
           VALUES (gen_random_uuid()::TEXT, $1,$2,$3,'import','xlsx',$4,$5,$6,$7,$8,$9)`,
          [
            userId ?? null, userName ?? null, module,
            outcome.total, outcome.created, outcome.updated, outcome.skipped, outcome.failed, status,
          ],
        );
        parts.push(
          `${label} — ${outcome.created} created, ${outcome.updated} updated, ` +
            `${outcome.skipped} skipped, ${outcome.failed} failed`,
        );
      }
      await this.logActivity(`Imported CRM workbook: ${parts.join('; ')}`, userId, userName);
    } catch (err) {
      this.logger.error('Failed to record import audit', err instanceof Error ? err.stack : String(err));
    }
  }

  /**
   * Records a Global Export run: one `import_export_audit` row per exported
   * module (with its record count) plus a single combined `activities` entry.
   */
  async recordExportRun(params: {
    userId?: string;
    userName?: string;
    modules: { module: string; count: number }[];
  }): Promise<void> {
    const { userId, userName, modules } = params;
    if (!modules?.length) return;
    try {
      const parts: string[] = [];
      for (const { module, count } of modules) {
        const label = MODULE_LABEL[module] ?? module;
        await this.db.query(
          `INSERT INTO import_export_audit
             (id, user_id, user_name, module, action, file_format,
              total_records, created_records, updated_records, skipped_records, failed_records, status)
           VALUES (gen_random_uuid()::TEXT, $1,$2,$3,'export','xlsx',$4,0,0,0,0,'success')`,
          [userId ?? null, userName ?? null, module, count],
        );
        parts.push(`${count} ${label}`);
      }
      await this.logActivity(`Exported CRM workbook (XLSX): ${parts.join(', ')}`, userId, userName);
    } catch (err) {
      this.logger.error('Failed to record export audit', err instanceof Error ? err.stack : String(err));
    }
  }

  /** Recent audit rows for the requesting user, newest first. */
  async findForUser(userId: string, limit = 100): Promise<any[]> {
    const { rows } = await this.db.query(
      `SELECT id, user_id, user_name, module, action, file_format,
              total_records, created_records, updated_records, skipped_records, failed_records,
              status, created_at
       FROM import_export_audit
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit],
    );
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id ?? undefined,
      userName: r.user_name ?? undefined,
      module: r.module,
      action: r.action,
      fileFormat: r.file_format ?? undefined,
      totalRecords: r.total_records,
      createdRecords: r.created_records,
      updatedRecords: r.updated_records,
      skippedRecords: r.skipped_records,
      failedRecords: r.failed_records,
      status: r.status,
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    }));
  }

  private async logActivity(text: string, userId?: string, userName?: string): Promise<void> {
    await this.db.query(
      `INSERT INTO activities (id, type, text, user_id, user_name)
       VALUES (gen_random_uuid()::TEXT, 'general', $1, $2, $3)`,
      [text, userId ?? null, userName ?? 'System'],
    );
  }
}
