import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './modules/auth/auth.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { OpportunitiesModule } from './modules/opportunities/opportunities.module';
import { ActionItemsModule } from './modules/action-items/action-items.module';
import { StakeholdersModule } from './modules/stakeholders/stakeholders.module';
import { ActivitiesModule } from './modules/activities/activities.module';
import { CommentsModule } from './modules/comments/comments.module';
import { CustomColumnsModule } from './modules/custom-columns/custom-columns.module';
import { ColumnConfigsModule } from './modules/column-configs/column-configs.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { FinancialYearsModule } from './modules/financial-years/financial-years.module';
import { AdministrationModule } from './modules/administration/administration.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { HealthModule } from './modules/health/health.module';
import { PerformanceEvaluationsModule } from './modules/performance-evaluations/performance-evaluations.module';
import { EmployeeMasterModule } from './modules/employee-master/employee-master.module';
import { ImportExportModule } from './modules/import-export/import-export.module';

@Module({
  imports: [
    // Rate limiting: 200 requests/min per IP globally (auth endpoints override this lower)
    ThrottlerModule.forRoot([{
      name: 'default',
      ttl: 60000,
      limit: 200,
    }]),
    DatabaseModule,
    CommonModule,
    ImportExportModule,
    NotificationsModule,
    AlertsModule,
    AuthModule,
    AccountsModule,
    OpportunitiesModule,
    ActionItemsModule,
    StakeholdersModule,
    ActivitiesModule,
    CommentsModule,
    CustomColumnsModule,
    ColumnConfigsModule,
    DocumentsModule,
    FinancialYearsModule,
    AdministrationModule,
    EmployeeMasterModule,
    AnalyticsModule,
    HealthModule,
    PerformanceEvaluationsModule,
  ],
  providers: [
    // Apply rate limiting globally; auth controller methods set tighter limits
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
