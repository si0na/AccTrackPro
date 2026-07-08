import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { MigrationRunner } from './migration-runner.service';

@Injectable()
export class DatabaseBootstrap implements OnModuleInit {
  private readonly logger = new Logger(DatabaseBootstrap.name);

  constructor(
    private readonly migrationRunner: MigrationRunner,
    private readonly db: DatabaseService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Bootstrap starting...');
    await this.migrationRunner.run();
    this.logger.log('Migrations complete');
    await this.db.backfillOwnerIds();
    this.logger.log('Bootstrap complete — application is ready');
  }
}
