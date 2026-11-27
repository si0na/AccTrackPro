import { Injectable, Logger } from '@nestjs/common';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { DatabaseService } from './database.service';

@Injectable()
export class MigrationRunner {
  private readonly logger = new Logger(MigrationRunner.name);

  constructor(private readonly db: DatabaseService) {}

  async run(): Promise<void> {
    this.logger.log('Checking pending migrations...');
    await this.ensureMigrationsTable();

    const { rows } = await this.db.query(
      `SELECT version, name FROM schema_migrations ORDER BY version`,
    );
    const appliedMap = new Map<string, string>(
      rows.map((r: any) => [r.version as string, r.name as string]),
    );

    const files = this.getMigrationFiles();

    // Check for duplicate numeric prefixes among migration files on disk
    const seenVersions = new Map<string, string>();
    for (const file of files) {
      const version = file.replace(/\.sql$/, '').split('_')[0];
      if (seenVersions.has(version)) {
        throw new Error(
          `Duplicate migration version "${version}" detected: both "${seenVersions.get(version)}" and "${file}" share the same numeric prefix.`,
        );
      }
      seenVersions.set(version, file);
    }

    // Check for version recorded under a different name in schema_migrations
    for (const file of files) {
      const version = file.replace(/\.sql$/, '').split('_')[0];
      const diskName = file.replace(/\.sql$/, '');
      const recordedName = appliedMap.get(version);
      if (recordedName !== undefined && recordedName !== diskName) {
        throw new Error(
          `Migration version mismatch for version "${version}": already recorded in schema_migrations as "${recordedName}", but disk file is "${diskName}". Please use an unused number instead of reusing an applied one.`,
        );
      }
    }

    let ran = 0;

    for (const file of files) {
      const version = file.replace(/\.sql$/, '').split('_')[0];
      if (appliedMap.has(version)) continue;

      const sql = readFileSync(join(__dirname, 'migrations', file), 'utf-8');
      const client = await this.db.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          `INSERT INTO schema_migrations (version, name) VALUES ($1, $2)`,
          [version, file.replace(/\.sql$/, '')],
        );
        await client.query('COMMIT');
        this.logger.log(`Applied migration ${file}`);
        ran++;
      } catch (err) {
        await client.query('ROLLBACK');
        this.logger.error(`Migration ${file} failed — rolling back`, err);
        throw err;
      } finally {
        client.release();
      }
    }

    if (ran === 0) {
      this.logger.log('All migrations up to date');
    } else {
      this.logger.log(`${ran} migration(s) applied`);
    }
  }

  private async ensureMigrationsTable(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    TEXT        PRIMARY KEY,
        name       TEXT        NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  private getMigrationFiles(): string[] {
    const dir = join(__dirname, 'migrations');
    return readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
  }
}
