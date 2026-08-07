import { Client } from 'pg';

const client = new Client({ connectionString: 'postgresql://postgres:1234@localhost:5432/crm_db' });

client.connect().then(async () => {
  try {
    // 1. Get an account manager
    const res = await client.query(`
      SELECT u.id, u.email, ur.role_id 
      FROM users u 
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE r.key = 'account-manager'
      LIMIT 1
    `);
    const am = res.rows[0];
    console.log("Found AM:", am);

    if (!am) return;

    // 2. What accounts do they own/manage?
    const accs = await client.query(`
      SELECT id, name, owner_id, account_manager_id 
      FROM accounts 
      WHERE account_manager_id = $1 OR owner_id = $1
    `, [am.id]);
    console.log("AM Accounts:", accs.rows);

    // 3. Find if they have permissions in code? No, we need an API call for that.
  } catch(e) {
    console.error(e);
  } finally {
    client.end();
  }
});
