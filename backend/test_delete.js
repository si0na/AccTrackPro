import fetch from 'node-fetch';

async function main() {
  const base = 'http://localhost:3000/api';

  // 1. Register a new user
  const email = `am${Date.now()}@example.com`;
  const regRes = await fetch(`${base}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password', name: 'Test AM', role: 'Account Manager' }),
  });
  const regData = await regRes.json();
  console.log('Register:', regRes.status, regData);

  const token = regData.accessToken;
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  // 2. Check permissions
  const pRes = await fetch(`${base}/rbac/permissions/me`, { headers });
  const pData = await pRes.json();
  console.log('Permissions:', pData);
  console.log('Can delete account?', pData.permissions.includes('accounts:delete'));

  // 3. Create an account
  const accRes = await fetch(`${base}/accounts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: `Acc ${Date.now()}` }),
  });
  const accData = await accRes.json();
  console.log('Create Account:', accRes.status, accData);

  // 4. Delete the account
  if (accData.id) {
    const delRes = await fetch(`${base}/accounts/${accData.id}`, {
      method: 'DELETE',
      headers,
    });
    console.log('Delete Account:', delRes.status, await delRes.text());
  }
}

main().catch(console.error);
