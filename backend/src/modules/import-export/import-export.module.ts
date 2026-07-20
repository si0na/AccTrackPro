import { Module } from '@nestjs/common';
import { ImportExportController } from './import-export.controller';
import { ImportExportAuditService } from './import-export-audit.service';
import { GlobalImportExportService } from './global-import-export.service';
import { AccountsModule } from '../accounts/accounts.module';
import { StakeholdersModule } from '../stakeholders/stakeholders.module';
import { OpportunitiesModule } from '../opportunities/opportunities.module';
import { ActionItemsModule } from '../action-items/action-items.module';

/**
 * Global Import/Export. Imports the four CRM modules so the orchestrator can
 * funnel every write through their own services (preserving all business
 * logic), and owns the shared import/export audit trail.
 */
@Module({
  imports: [AccountsModule, StakeholdersModule, OpportunitiesModule, ActionItemsModule],
  controllers: [ImportExportController],
  providers: [GlobalImportExportService, ImportExportAuditService],
})
export class ImportExportModule {}
