async function main() {
  const base = 'http://localhost:3000/api';

  const email = `am${Date.now()}@example.com`;
  const regRes = await fetch(`${base}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password', name: 'Test AM', role: 'Account Manager' }),
  });
  const regData = await regRes.json();
  console.log('Register:', regRes.status);

  const token = regData.accessToken;
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  const pRes = await fetch(`${base}/rbac/permissions/me`, { headers });
  const pData = await pRes.json();
  console.log('Can delete account?', pData.permissions.includes('accounts:delete'));

  const accRes = await fetch(`${base}/accounts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: `Acc ${Date.now()}` }),
  });
  const accData = await accRes.json();
  console.log('Create Account:', accRes.status);

  if (accData.id) {
    const delRes = await fetch(`${base}/accounts/${accData.id}`, {
      method: 'DELETE',
      headers,
    });
    console.log('Delete Account:', delRes.status, await delRes.text());
  }
}

main().catch(console.error);
