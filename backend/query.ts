import { Client } from 'pg';

const client = new Client({ connectionString: 'postgresql://postgres:1234@localhost:5432/crm_db' });

client.connect().then(async () => {
  try {
    // Check: does the stakeholders query with child visibility actually return SP records?
    // Simulate what the backend does for user rajakrishnan (the pure account-manager)
    const amUserId = '5a9fdf59-fefd-46e5-8e7f-8e565ab7bbc3';

    // First check: what does the user's context look like?
    const roleRes = await client.query(`
      SELECT r.key, r.account_scope_field
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = $1
    `, [amUserId]);
    console.log("User roles:", roleRes.rows);

    // Check what the child visibility query would produce
    // For account-manager, scope is: acc_scope.account_manager_id = $userId
    const stRes = await client.query(`
      SELECT s.id, s.name, s.stakeholder_type, s.account_id, a.name as acc_name
      FROM stakeholders s
      INNER JOIN accounts a ON s.account_id = a.id AND a.is_deleted = FALSE
      WHERE s.is_deleted = FALSE
        AND EXISTS (SELECT 1 FROM accounts acc_scope 
                    WHERE acc_scope.id = s.account_id 
                      AND acc_scope.is_deleted = FALSE
                      AND acc_scope.account_manager_id = $1)
      ORDER BY s.created_at DESC
    `, [amUserId]);
    console.log("\nStakeholders visible to AM user:", stRes.rows.length);
    for (const row of stRes.rows) {
      console.log(`  ${row.stakeholder_type}: ${row.name} (acc: ${row.acc_name})`);
    }

    // Also check: how many SP stakeholders exist for Siona (admin+AM)?
    const sionaId = 'b177a6c4-669f-47a7-96c4-c1a658eb5975';
    const sionaRoles = await client.query(`
      SELECT r.key, r.account_scope_field
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = $1
    `, [sionaId]);
    console.log("\nSiona roles:", sionaRoles.rows);

    // Siona has admin -> view-all, so no scope restriction
    const sionaStRes = await client.query(`
      SELECT COUNT(*) as total, 
             COUNT(*) FILTER (WHERE s.stakeholder_type = 'SERVICE_PROVIDER') as sp_count,
             COUNT(*) FILTER (WHERE s.stakeholder_type = 'CLIENT') as client_count
      FROM stakeholders s
      INNER JOIN accounts a ON s.account_id = a.id AND a.is_deleted = FALSE
      WHERE s.is_deleted = FALSE
    `);
    console.log("\nAll non-deleted stakeholders (admin view):", sionaStRes.rows[0]);

    // Check permissions for accounts:view-all
    const viewAllRes = await client.query(`
      SELECT r.key, rp.is_allowed
      FROM role_permissions rp
      JOIN roles r ON r.id = rp.role_id
      WHERE rp.module_key = 'accounts' AND rp.permission_key = 'view-all'
        AND r.key = 'account-manager'
    `);
    console.log("\nAM accounts:view-all:", viewAllRes.rows);

  } catch(e) {
    console.error(e);
  } finally {
    client.end();
  }
});
