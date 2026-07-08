/**
 * Development-only seed script.
 *
 * Run with:  npm run seed:dev
 *
 * Creates the four default CRM users (Account Manager, Delivery Manager,
 * Sales Manager, Practice Head) if the users table is empty.
 * Refuses to run when NODE_ENV=production.
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    console.error('[seed] ERROR: Seeding is not permitted in production. Aborting.');
    process.exit(1);
  }

  const connStr = process.env.DATABASE_URL;
  if (!connStr) {
    console.error('[seed] ERROR: DATABASE_URL environment variable is required');
    process.exit(1);
  }

  console.log('[seed] Connecting to database...');
  const pool = new Pool({ connectionString: connStr });

  try {
    const { rows: check } = await pool.query(
      `SELECT COUNT(*)::INTEGER AS cnt FROM users`,
    );
    if (check[0].cnt > 0) {
      console.log(`[seed] Skipped — ${check[0].cnt} user(s) already present.`);
      return;
    }

    console.log('[seed] Seeding default users...');
    const hash = await bcrypt.hash('password123', 10);

    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role, avatar_data) VALUES
       (gen_random_uuid()::TEXT, 'John Smith',    'john.smith@enterprise.com',    $1, 'Account Manager',  ''),
       (gen_random_uuid()::TEXT, 'Sarah Johnson', 'sarah.johnson@enterprise.com', $1, 'Delivery Manager', ''),
       (gen_random_uuid()::TEXT, 'Mike Brown',    'mike.brown@enterprise.com',    $1, 'Sales Manager',    ''),
       (gen_random_uuid()::TEXT, 'Lisa Davis',    'lisa.davis@enterprise.com',    $1, 'Practice Head',    '')
       ON CONFLICT (email) DO NOTHING`,
      [hash],
    );

    const { rows: after } = await pool.query(
      `SELECT COUNT(*)::INTEGER AS cnt FROM users`,
    );
    console.log(`[seed] Done — ${after[0].cnt} user(s) now present.`);
  } finally {
    await pool.end();
    console.log('[seed] Database connection closed.');
  }
}

main().catch((err: unknown) => {
  console.error('[seed] Fatal error:', err);
  process.exit(1);
});
