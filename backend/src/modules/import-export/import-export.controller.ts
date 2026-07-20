import { Controller, Get, Post, Body, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { GlobalImportExportService, WorkbookSheets, WorkbookImportRequest } from './global-import-export.service';
import { ImportExportAuditService } from './import-export-audit.service';
import { GlobalImportDto, ExportLogDto } from './dto/import-export.dto';
import { MODULE_ORDER, IEModuleKey } from './import-field-schemas';
import { AuthUser, JwtPayload } from '../auth/auth-user.decorator';

/**
 * Global Import/Export surface — one workbook, four worksheets. Validation and
 * commit both accept every module's rows in a single request so cross-sheet
 * dependencies (a child referencing a parent defined in the same workbook) can
 * be resolved. Rows are read from the RAW request body so custom-column keys and
 * pending-parent markers survive the global whitelist pipe.
 */
@Controller('import-export')
export class ImportExportController {
  constructor(
    private readonly service: GlobalImportExportService,
    private readonly audit: ImportExportAuditService,
  ) {}

  /** Reads `{ [module]: { rows, headers } }` from the raw body, keeping only known modules. */
  private readSheets(body: { sheets?: Record<string, any> }): WorkbookSheets {
    const raw = body?.sheets ?? {};
    const sheets: WorkbookSheets = {};
    for (const module of MODULE_ORDER) {
      const s = raw[module];
      if (!s) continue;
      const rows = Array.isArray(s.rows) ? (s.rows as Record<string, any>[]) : [];
      if (rows.length === 0) continue; // ignore empty worksheets
      const headers = Array.isArray(s.headers) ? (s.headers as unknown[]).map((h) => String(h)) : [];
      sheets[module] = { rows, headers };
    }
    return sheets;
  }

  /** Reads `{ [module]: Row[] }` from the raw body, keeping only known modules. */
  private readModules(body: { modules?: Record<string, any> }): WorkbookImportRequest {
    const raw = body?.modules ?? {};
    const modules: WorkbookImportRequest = {};
    for (const module of MODULE_ORDER as IEModuleKey[]) {
      const rows = raw[module];
      if (Array.isArray(rows) && rows.length) modules[module] = rows as Record<string, any>[];
    }
    return modules;
  }

  // Dry-run validation across every populated worksheet — no writes.
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  validate(@Req() req: { body: { sheets?: Record<string, any> } }, @AuthUser() authUser: JwtPayload) {
    return this.service.validateWorkbook(this.readSheets(req.body), authUser.sub);
  }

  // Commit the kept rows in dependency order.
  @Post('import')
  @HttpCode(HttpStatus.OK)
  import(
    @Body() body: GlobalImportDto,
    @Req() req: { body: { modules?: Record<string, any> } },
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.service.importWorkbook(
      this.readModules(req.body),
      body.duplicateMode ?? 'skip',
      authUser.sub,
      authUser.name,
    );
  }

  @Post('export-log')
  @HttpCode(HttpStatus.CREATED)
  async logExport(@Body() body: ExportLogDto, @AuthUser() authUser: JwtPayload) {
    const modules = (body.modules ?? [])
      .filter((m) => m && typeof m.module === 'string')
      .map((m) => ({ module: m.module, count: Number(m.count) || 0 }));
    await this.audit.recordExportRun({ userId: authUser.sub, userName: authUser.name, modules });
    return { success: true };
  }

  @Get('audit')
  getAudit(@AuthUser() authUser: JwtPayload) {
    return this.audit.findForUser(authUser.sub);
  }
}
