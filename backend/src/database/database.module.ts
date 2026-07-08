import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { MigrationRunner } from './migration-runner.service';
import { DatabaseBootstrap } from './database-bootstrap.service';

@Global()
@Module({
  providers: [DatabaseService, MigrationRunner, DatabaseBootstrap],
  exports: [DatabaseService],
})
export class DatabaseModule {}
