import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { Pool, PoolClient, types } from 'pg';
import type { QueryResult } from 'pg';

// Parse numeric types as JS numbers instead of strings (pg default).
types.setTypeParser(types.builtins.NUMERIC, (v) => parseFloat(v));
types.setTypeParser(types.builtins.FLOAT4, (v) => parseFloat(v));
types.setTypeParser(types.builtins.FLOAT8, (v) => parseFloat(v));
types.setTypeParser(types.builtins.INT2, (v) => parseInt(v, 10));
types.setTypeParser(types.builtins.INT4, (v) => parseInt(v, 10));
types.setTypeParser(types.builtins.INT8, (v) => parseInt(v, 10));

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  readonly pool: Pool;

  constructor() {
    const connStr = process.env.DATABASE_URL;
    if (!connStr) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    this.pool = new Pool({
      connectionString: connStr,
      max:                     parseInt(process.env.DB_POOL_MAX          ?? '10',    10),
      idleTimeoutMillis:       parseInt(process.env.DB_IDLE_TIMEOUT_MS   ?? '30000', 10),
      connectionTimeoutMillis: parseInt(process.env.DB_CONN_TIMEOUT_MS   ?? '5000',  10),
    });

    try {
      const u = new URL(connStr);
      this.logger.log(
        `Pool configured [host=${u.hostname}:${u.port || 5432} db=${u.pathname.slice(1)}]`,
      );
    } catch {
      this.logger.log('Database pool configured');
    }

    this.pool.on('error', (err: Error) =>
      this.logger.error('Idle DB client error', err.stack),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  async query(text: string, params?: any[]): Promise<QueryResult<any>> {
    return this.pool.query(text, params);
  }

  async withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Backfills UUID FK columns (owner_id, user_id) from the legacy denormalised
   * text columns by matching on display names. Also cleans up stale notification
   * rows and normalises notification_category values.
   *
   * Runs on every startup after seeding — all statements are idempotent (they
   * only update rows where the target column is still NULL or holds a raw name).
   */
  async backfillOwnerIds(): Promise<void> {
    await this.pool.query(
      `UPDATE accounts a SET owner_id = u.id FROM users u
       WHERE u.name = a.owner AND a.owner_id IS NULL`,
    );
    await this.pool.query(
      `UPDATE opportunities o SET owner_id = u.id FROM users u
       WHERE u.name = o.owner AND o.owner_id IS NULL`,
    );
    await this.pool.query(
      `UPDATE action_items ai SET owner_id = u.id FROM users u
       WHERE u.name = ai.owner AND ai.owner_id IS NULL`,
    );
    await this.pool.query(
      `UPDATE activities act SET user_id = u.id FROM users u
       WHERE u.name = act.user_name AND act.user_id IS NULL`,
    );
    await this.pool.query(
      `UPDATE comments c SET user_id = u.id FROM users u
       WHERE u.name = c.user_name AND c.user_id IS NULL`,
    );
    // Remove legacy rows that stored the string 'System' as user_id — these
    // violate the FK once the constraint is applied.
    await this.pool.query(
      `DELETE FROM notifications WHERE user_id = 'System'`,
    );
    // Migrate notifications.user_id: rows that currently store a display name
    // instead of a UUID are updated to the real UUID.
    await this.pool.query(
      `UPDATE notifications n SET user_id = u.id FROM users u
       WHERE u.name = n.user_id`,
    );
    // Backfill notification_category from type column.
    await this.pool.query(
      `UPDATE notifications
       SET notification_category = CASE WHEN type = 'System' THEN 'SYSTEM' ELSE 'BUSINESS' END
       WHERE notification_category = 'BUSINESS' AND type = 'System'`,
    );
    this.logger.log('Owner/user FK columns backfilled');
  }
}
