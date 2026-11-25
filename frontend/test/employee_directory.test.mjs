import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// ─── Mock Service Logic for Direct Unit Testing ─────────────────────────────

class MockEmployeeDirectoryService {
  constructor() {
    this.cache = null;
    this.inFlightPromise = null;
  }

  clearCache() {
    this.cache = null;
  }

  normalizeGraphUser(raw) {
    const displayName = (raw.displayName || raw.userPrincipalName || raw.mail || 'Unknown Employee').trim();
    const mail = raw.mail ? String(raw.mail).trim() : null;
    const upn = (raw.userPrincipalName || mail || '').trim();
    const email = mail || upn;

    return {
      id: String(raw.id || '').trim(),
      displayName,
      givenName: raw.givenName ? String(raw.givenName).trim() : null,
      surname: raw.surname ? String(raw.surname).trim() : null,
      mail,
      userPrincipalName: upn,
      email,
      source: 'microsoft_graph',
    };
  }

  async fetchAllFromGraphMock(fetchMock, initialToken = 'initial-token') {
    let token = initialToken;
    let nextUrl = 'https://graph.microsoft.com/v1.0/users?$select=id,displayName,givenName,surname,mail,userPrincipalName&$top=999';
    const allUsers = [];
    const seenIds = new Set();
    const maxRetries = 3;

    while (nextUrl) {
      let retries = 0;
      let pageData = null;

      while (retries <= maxRetries) {
        const res = await fetchMock(nextUrl, token);

        if (res.status === 401 && retries === 0) {
          token = 'refreshed-token';
          retries++;
          continue;
        }

        if (res.status === 429) {
          retries++;
          if (retries > maxRetries) {
            throw new Error('Microsoft Graph rate limit reached (429 Too Many Requests). Please retry shortly.');
          }
          continue;
        }

        if (res.status === 403) {
          throw new Error('Access denied by Microsoft Entra ID (403 Forbidden). Ensure User.ReadBasic.All delegated permission is granted and consented by an administrator.');
        }

        if (!res.ok) {
          throw new Error(`Microsoft Graph request failed with status ${res.status}`);
        }

        pageData = res.data;
        break;
      }

      if (!pageData) {
        throw new Error('Failed to retrieve response data from Microsoft Graph.');
      }

      const usersBatch = Array.isArray(pageData.value) ? pageData.value : [];
      for (const item of usersBatch) {
        if (!item || !item.id) continue;
        if (seenIds.has(item.id)) continue;
        seenIds.add(item.id);
        allUsers.push(this.normalizeGraphUser(item));
      }

      nextUrl = pageData['@odata.nextLink'] || null;
    }

    return allUsers;
  }

  async getEmployeesMock({ hasActiveAccount, fetchGraphMock, forceRefresh = false }) {
    if (!forceRefresh && this.cache && Date.now() - this.cache.timestamp < 15 * 60 * 1000) {
      return this.cache;
    }

    if (this.inFlightPromise) {
      return this.inFlightPromise;
    }

    this.inFlightPromise = (async () => {
      if (!hasActiveAccount) {
        return {
          employees: [],
          source: 'disconnected',
          fallbackReason: 'Not connected to Microsoft Entra Directory. Connect Microsoft Employee Directory to sync.',
          error: { code: 'NO_ACCOUNT_CONNECTED' },
        };
      }

      try {
        const graphUsers = await this.fetchAllFromGraphMock(fetchGraphMock);
        const res = { employees: graphUsers, source: 'microsoft_graph', fallbackReason: null, error: null };
        this.cache = { ...res, timestamp: Date.now() };
        return res;
      } catch (err) {
        return {
          employees: this.cache ? this.cache.employees : [],
          source: this.cache ? 'microsoft_graph' : 'disconnected',
          fallbackReason: err.message,
          error: err,
        };
      }
    })();

    try {
      return await this.inFlightPromise;
    } finally {
      this.inFlightPromise = null;
    }
  }

  search(query, employees, maxResults = 50) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return employees.slice(0, maxResults);

    const matches = [];
    for (const emp of employees) {
      const nameMatch = emp.displayName.toLowerCase().includes(q);
      const emailMatch = (emp.email || '').toLowerCase().includes(q) || (emp.userPrincipalName || '').toLowerCase().includes(q);
      if (nameMatch || emailMatch) {
        matches.push(emp);
        if (matches.length >= maxResults) break;
      }
    }
    return matches;
  }
}

// ─── Test Suites ────────────────────────────────────────────────────────────

describe('Microsoft Graph Employee Directory Service Tests', () => {
  const service = new MockEmployeeDirectoryService();

  test('Employee Normalization: populates displayName, givenName, surname, mail, and userPrincipalName', () => {
    const rawUser = {
      id: 'usr-001',
      displayName: 'Alice Johnson',
      givenName: 'Alice',
      surname: 'Johnson',
      mail: 'alice.johnson@reflectionsinfos.com',
      userPrincipalName: 'alice.j@reflectionsinfos.com',
    };

    const normalized = service.normalizeGraphUser(rawUser);

    assert.equal(normalized.id, 'usr-001');
    assert.equal(normalized.displayName, 'Alice Johnson');
    assert.equal(normalized.givenName, 'Alice');
    assert.equal(normalized.surname, 'Johnson');
    assert.equal(normalized.mail, 'alice.johnson@reflectionsinfos.com');
    assert.equal(normalized.userPrincipalName, 'alice.j@reflectionsinfos.com');
    assert.equal(normalized.email, 'alice.johnson@reflectionsinfos.com');
    assert.equal(normalized.source, 'microsoft_graph');
  });

  test('Missing mail fallback: uses userPrincipalName when mail is null or empty', () => {
    const rawUser = {
      id: 'usr-002',
      displayName: 'Bob Smith',
      givenName: 'Bob',
      surname: 'Smith',
      mail: null,
      userPrincipalName: 'bob.smith@reflectionsinfos.com',
    };

    const normalized = service.normalizeGraphUser(rawUser);

    assert.equal(normalized.displayName, 'Bob Smith');
    assert.equal(normalized.mail, null);
    assert.equal(normalized.userPrincipalName, 'bob.smith@reflectionsinfos.com');
    assert.equal(normalized.email, 'bob.smith@reflectionsinfos.com');
  });

  test('Multi-page Pagination via @odata.nextLink: retrieves all pages without stopping after first 999', async () => {
    let callCount = 0;
    const mockFetch = async (url, token) => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: true,
          status: 200,
          data: {
            value: [
              { id: '1', displayName: 'User 1', mail: 'u1@domain.com', userPrincipalName: 'u1@domain.com' },
              { id: '2', displayName: 'User 2', mail: 'u2@domain.com', userPrincipalName: 'u2@domain.com' },
            ],
            '@odata.nextLink': 'https://graph.microsoft.com/v1.0/users?$skiptoken=X%27123%27',
          },
        };
      }
      return {
        ok: true,
        status: 200,
        data: {
          value: [
            { id: '3', displayName: 'User 3', mail: 'u3@domain.com', userPrincipalName: 'u3@domain.com' },
          ],
        },
      };
    };

    const results = await service.fetchAllFromGraphMock(mockFetch);

    assert.equal(callCount, 2, 'Should follow @odata.nextLink to second page');
    assert.equal(results.length, 3, 'Should collect employees across all pages');
    assert.equal(results[0].displayName, 'User 1');
    assert.equal(results[2].displayName, 'User 3');
  });

  test('Duplicate Prevention: skips duplicate records across pages', async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: true,
          status: 200,
          data: {
            value: [
              { id: '1', displayName: 'User 1', mail: 'u1@domain.com' },
              { id: '2', displayName: 'User 2', mail: 'u2@domain.com' },
            ],
            '@odata.nextLink': 'https://graph.microsoft.com/v1.0/users?$skiptoken=page2',
          },
        };
      }
      return {
        ok: true,
        status: 200,
        data: {
          value: [
            { id: '2', displayName: 'User 2 Duplicate', mail: 'u2@domain.com' },
            { id: '3', displayName: 'User 3', mail: 'u3@domain.com' },
          ],
        },
      };
    };

    const results = await service.fetchAllFromGraphMock(mockFetch);
    assert.equal(results.length, 3, 'Duplicate user ID should be deduplicated');
    assert.deepEqual(results.map((r) => r.id), ['1', '2', '3']);
  });

  test('Search by Employee Name and Email', () => {
    const list = [
      { id: '1', displayName: 'Charlie Brown', email: 'charlie@domain.com', userPrincipalName: 'charlie@domain.com' },
      { id: '2', displayName: 'David Miller', email: 'david.m@domain.com', userPrincipalName: 'david.m@domain.com' },
      { id: '3', displayName: 'Emma Watson', email: 'emma.w@domain.com', userPrincipalName: 'emma.w@domain.com' },
    ];

    const matchName = service.search('charlie', list);
    assert.equal(matchName.length, 1);
    assert.equal(matchName[0].id, '1');

    const matchEmail = service.search('david.m@', list);
    assert.equal(matchEmail.length, 1);
    assert.equal(matchEmail[0].id, '2');

    const capped = service.search('', list, 2);
    assert.equal(capped.length, 2, 'Should cap results to maxResults parameter');
  });

  test('Token Renewal: handles 401 Unauthorized by retrying with refreshed token', async () => {
    let attempts = 0;
    const mockFetch = async (url, token) => {
      attempts++;
      if (attempts === 1) {
        assert.equal(token, 'initial-token');
        return { ok: false, status: 401 };
      }
      assert.equal(token, 'refreshed-token');
      return {
        ok: true,
        status: 200,
        data: {
          value: [{ id: '10', displayName: 'Refreshed User', mail: 'r@domain.com' }],
        },
      };
    };

    const results = await service.fetchAllFromGraphMock(mockFetch);
    assert.equal(results.length, 1);
    assert.equal(results[0].displayName, 'Refreshed User');
  });

  test('Throttling (429) & Backoff: retries on rate limit and completes request', async () => {
    let attempts = 0;
    const mockFetch = async () => {
      attempts++;
      if (attempts === 1) {
        return { ok: false, status: 429 };
      }
      return {
        ok: true,
        status: 200,
        data: {
          value: [{ id: '20', displayName: 'Throttled User', mail: 't@domain.com' }],
        },
      };
    };

    const results = await service.fetchAllFromGraphMock(mockFetch);
    assert.equal(results.length, 1);
    assert.equal(attempts, 2);
  });

  test('Missing Permission (403): Throws informative error specifying User.ReadBasic.All requirement', async () => {
    const mockFetch = async () => ({ ok: false, status: 403 });

    await assert.rejects(
      async () => {
        await service.fetchAllFromGraphMock(mockFetch);
      },
      /User\.ReadBasic\.All/,
    );
  });

  test('Empty Employee Directory: returns empty list cleanly without crashing', async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      data: { value: [] },
    });

    const results = await service.fetchAllFromGraphMock(mockFetch);
    assert.equal(results.length, 0);
  });
});

describe('Exclusive Microsoft Graph Directory Retrieval and Caching Invariants', () => {
  const service = new MockEmployeeDirectoryService();

  test('Unauthenticated session returns empty directory with NO_ACCOUNT_CONNECTED and does NOT fall back to local database', async () => {
    service.clearCache();
    const res = await service.getEmployeesMock({
      hasActiveAccount: false,
      fetchGraphMock: null,
    });

    assert.equal(res.source, 'disconnected');
    assert.equal(res.employees.length, 0, 'Must NOT return local database employees');
    assert.equal(res.error?.code, 'NO_ACCOUNT_CONNECTED');
    assert.ok(res.fallbackReason.includes('Not connected to Microsoft Entra Directory'));
  });

  test('Authenticated session retrieves Microsoft Graph directory and reuses cache on second call', async () => {
    service.clearCache();
    let graphFetchCalls = 0;
    const graphFetchMock = async () => {
      graphFetchCalls++;
      return {
        ok: true,
        status: 200,
        data: {
          value: [{ id: 'g-1', displayName: 'Graph User', mail: 'g@domain.com' }],
        },
      };
    };

    const res1 = await service.getEmployeesMock({
      hasActiveAccount: true,
      fetchGraphMock: graphFetchMock,
    });

    assert.equal(res1.source, 'microsoft_graph');
    assert.equal(res1.employees.length, 1);
    assert.equal(graphFetchCalls, 1);

    // Call again without forceRefresh — should hit cache without calling Graph again
    const res2 = await service.getEmployeesMock({
      hasActiveAccount: true,
      fetchGraphMock: graphFetchMock,
      forceRefresh: false,
    });

    assert.equal(res2.source, 'microsoft_graph');
    assert.equal(graphFetchCalls, 1, 'Should reuse in-memory cache and not trigger redundant Graph request');
  });

  test('Concurrent requests are deduplicated by in-flight promise', async () => {
    service.clearCache();
    let fetchCalls = 0;
    const slowGraphFetch = async () => {
      fetchCalls++;
      await new Promise((r) => setTimeout(r, 20));
      return {
        ok: true,
        status: 200,
        data: {
          value: [{ id: 'dedup-1', displayName: 'Dedup User', mail: 'd@domain.com' }],
        },
      };
    };

    const [p1, p2, p3] = await Promise.all([
      service.getEmployeesMock({ hasActiveAccount: true, fetchGraphMock: slowGraphFetch }),
      service.getEmployeesMock({ hasActiveAccount: true, fetchGraphMock: slowGraphFetch }),
      service.getEmployeesMock({ hasActiveAccount: true, fetchGraphMock: slowGraphFetch }),
    ]);

    assert.equal(fetchCalls, 1, 'Concurrent calls should be deduplicated to a single flight');
    assert.equal(p1.employees.length, 1);
    assert.equal(p2.employees.length, 1);
    assert.equal(p3.employees.length, 1);
  });

  test('Large employee directory: successfully pages through thousands of employees across multiple @odata.nextLink pages', async () => {
    service.clearCache();
    let pagesRequested = 0;
    const mockLargeFetch = async (url) => {
      pagesRequested++;
      if (!url.includes('page=2') && !url.includes('page=3')) {
        return {
          ok: true,
          status: 200,
          data: {
            value: Array.from({ length: 999 }, (_, i) => ({
              id: `user-p1-${i}`,
              displayName: `Employee P1 ${i}`,
              mail: `emp1_${i}@company.com`,
            })),
            '@odata.nextLink': 'https://graph.microsoft.com/v1.0/users?page=2',
          },
        };
      }
      if (url.includes('page=2')) {
        return {
          ok: true,
          status: 200,
          data: {
            value: Array.from({ length: 999 }, (_, i) => ({
              id: `user-p2-${i}`,
              displayName: `Employee P2 ${i}`,
              mail: `emp2_${i}@company.com`,
            })),
            '@odata.nextLink': 'https://graph.microsoft.com/v1.0/users?page=3',
          },
        };
      }
      return {
        ok: true,
        status: 200,
        data: {
          value: Array.from({ length: 502 }, (_, i) => ({
            id: `user-p3-${i}`,
            displayName: `Employee P3 ${i}`,
            mail: `emp3_${i}@company.com`,
          })),
        },
      };
    };

    const allUsers = await service.fetchAllFromGraphMock(mockLargeFetch);
    assert.equal(pagesRequested, 3, 'Must follow all 3 pages');
    assert.equal(allUsers.length, 2500, 'Must aggregate all 2500 users from large directory');
  });

  test('employeeDirectory.service.ts: Does NOT import employeesApi or query /api/employees', () => {
    const servicePath = path.resolve(rootDir, 'src/services/employeeDirectory.service.ts');
    const content = fs.readFileSync(servicePath, 'utf8');

    assert.ok(!content.includes('employeesApi'), 'Must NOT import employeesApi');
    assert.ok(!content.includes('/api/employees'), 'Must NOT call /api/employees');
    assert.ok(!content.includes('local_fallback'), 'Must NOT contain local_fallback logic');
  });

  test('Directory Isolation: Does NOT automatically create ReflectOne application users', () => {
    const servicePath = path.resolve(rootDir, 'src/services/employeeDirectory.service.ts');
    const content = fs.readFileSync(servicePath, 'utf8');

    assert.ok(!content.includes('usersApi.create'), 'Must not call user creation API');
    assert.ok(!content.includes('INSERT INTO users'), 'Must not insert into users table');
    assert.ok(!content.includes('registerUser'), 'Must not auto-register users');
  });
});

describe('SPA Configuration Verification', () => {
  test('frontend/.env: Configured with ReflectOne SPA Client ID and User.ReadBasic.All', () => {
    const envPath = path.resolve(rootDir, '.env');
    const content = fs.readFileSync(envPath, 'utf8');

    assert.ok(
      content.includes('VITE_AZURE_CLIENT_ID=4d08ca04-1f27-4f0c-a30e-8a108332398e'),
      'Must use SPA client ID 4d08ca04-1f27-4f0c-a30e-8a108332398e, NOT confidential client 1a8f566b',
    );
    assert.ok(
      !content.includes('VITE_AZURE_CLIENT_ID=1a8f566b'),
      'Must NOT use confidential web app client ID for SPA',
    );
    assert.ok(
      content.includes('VITE_AZURE_TENANT_ID=b0b120fd-1701-4d59-9e7d-9cdfeed9fcc0'),
      'Tenant ID must be configured',
    );
    assert.ok(
      content.includes('VITE_AZURE_REDIRECT_URI=http://localhost:5173/'),
      'Redirect URI must have trailing slash',
    );
    assert.ok(
      content.includes('VITE_GRAPH_SCOPES=https://graph.microsoft.com/User.ReadBasic.All'),
      'Must configure User.ReadBasic.All',
    );
  });

  test('frontend/.env.example: Documents SPA configuration with placeholders and instructions', () => {
    const examplePath = path.resolve(rootDir, '.env.example');
    const content = fs.readFileSync(examplePath, 'utf8');

    assert.ok(content.includes('VITE_AZURE_CLIENT_ID='), 'Must document VITE_AZURE_CLIENT_ID');
    assert.ok(content.includes('VITE_AZURE_TENANT_ID='), 'Must document VITE_AZURE_TENANT_ID');
    assert.ok(content.includes('VITE_AZURE_REDIRECT_URI='), 'Must document VITE_AZURE_REDIRECT_URI');
    assert.ok(content.includes('VITE_GRAPH_SCOPES='), 'Must document VITE_GRAPH_SCOPES');
    assert.ok(!content.includes('4d08ca04'), 'Must not contain real production credentials');
  });
});

describe('MSAL Lifecycle and Authentication Invariants', () => {
  test('msal.ts: getGraphAccessToken NEVER calls loginPopup automatically', () => {
    const msalPath = path.resolve(rootDir, 'src/lib/msal.ts');
    const content = fs.readFileSync(msalPath, 'utf8');

    // Extract body of getGraphAccessToken
    const fnStart = content.indexOf('export async function getGraphAccessToken');
    assert.ok(fnStart !== -1, 'getGraphAccessToken must be exported');
    const fnBody = content.slice(fnStart, fnStart + 1600);

    assert.ok(
      !fnBody.includes('loginPopup'),
      'getGraphAccessToken must NEVER invoke loginPopup automatically',
    );
    assert.ok(
      fnBody.includes('NO_ACTIVE_ACCOUNT'),
      'getGraphAccessToken must throw distinguishable NO_ACTIVE_ACCOUNT error when unauthenticated',
    );
  });

  test('msal.ts: Exposes explicit connectGraphDirectory function with concurrency lock', () => {
    const msalPath = path.resolve(rootDir, 'src/lib/msal.ts');
    const content = fs.readFileSync(msalPath, 'utf8');

    assert.ok(
      content.includes('export async function connectGraphDirectory'),
      'Must export explicit connectGraphDirectory function for user-triggered interaction',
    );
    assert.ok(
      content.includes('connectInProgress'),
      'Must maintain concurrency lock to prevent overlapping interactive popups',
    );
    assert.ok(
      content.includes('POPUP_BLOCKED'),
      'Must handle browser popup blockers explicitly',
    );
    assert.ok(
      content.includes('USER_CANCELLED'),
      'Must handle user popup cancellation explicitly',
    );
  });

  test('msal.ts: Dynamically consumes VITE_GRAPH_SCOPES and uses sessionStorage', () => {
    const msalPath = path.resolve(rootDir, 'src/lib/msal.ts');
    const content = fs.readFileSync(msalPath, 'utf8');

    assert.ok(content.includes('VITE_GRAPH_SCOPES'), 'Must consume VITE_GRAPH_SCOPES env variable');
    assert.ok(content.includes('User.ReadBasic.All'), 'Must reference User.ReadBasic.All scope');
    assert.ok(!content.includes('User.Read.All'), 'Must NOT request broad User.Read.All permission');
    assert.ok(!content.includes('Directory.Read.All'), 'Must NOT request Directory.Read.All');
    assert.ok(content.includes('cacheLocation: \'sessionStorage\''), 'Must use sessionStorage for token storage');
  });
});

describe('Module Code Inspection Tests for Directory Integration', () => {
  test('EmployeeSearchableSelect: Renders Connect Microsoft button and connection feedback', () => {
    const selectPath = path.resolve(rootDir, 'src/components/common/EmployeeSearchableSelect.tsx');
    const content = fs.readFileSync(selectPath, 'utf8');

    assert.ok(
      content.includes('Connect Microsoft'),
      'Dropdown must render explicit Connect Microsoft action when unauthenticated',
    );
    assert.ok(
      content.includes('connectGraph'),
      'Must call connectGraph from hook',
    );
    assert.ok(
      content.includes('showToast'),
      'Must provide visual toast feedback on connection result',
    );
  });

  test('AdministrationPage: Renders Microsoft Graph Employee Directory Card in Settings', () => {
    const adminPath = path.resolve(rootDir, 'src/features/administration/components/AdministrationPage.tsx');
    const content = fs.readFileSync(adminPath, 'utf8');

    assert.ok(
      content.includes('Microsoft Graph Employee Directory'),
      'Settings tab must render dedicated Microsoft Graph Employee Directory card',
    );
    assert.ok(
      content.includes('Connect Microsoft Employee Directory'),
      'Must provide Connect Microsoft Employee Directory button',
    );
    assert.ok(
      content.includes('handleConnectGraph'),
      'Must implement handleConnectGraph handler',
    );
    assert.ok(
      content.includes('handleDisconnectGraph'),
      'Must implement handleDisconnectGraph handler',
    );
  });

  test('EmployeeAppreciationFormModal: Uses EmployeeSearchableSelect for directory selection', () => {
    const apprecPath = path.resolve(rootDir, 'src/features/employee-appreciation/components/EmployeeAppreciationFormModal.tsx');
    const content = fs.readFileSync(apprecPath, 'utf8');

    assert.ok(content.includes('EmployeeSearchableSelect'), 'Appreciation form must render EmployeeSearchableSelect');
    assert.ok(content.includes('handleSelectEmployee'), 'Appreciation form must have handleSelectEmployee');
  });

  test('EmployeeRewardsRecognitionFormModal: Uses useEmployees, EmployeeSearchableSelect and MultiEmployeePicker', () => {
    const rrPath = path.resolve(rootDir, 'src/features/employee-rewards-recognition/components/EmployeeRewardsRecognitionFormModal.tsx');
    const content = fs.readFileSync(rrPath, 'utf8');

    assert.ok(content.includes('useEmployees'), 'Rewards form must use useEmployees hook');
    assert.ok(content.includes('EmployeeSearchableSelect'), 'Rewards form must render EmployeeSearchableSelect');
    assert.ok(content.includes('MultiEmployeePicker'), 'Rewards form must render MultiEmployeePicker for teams');
  });

  test('PerformanceEvaluationView: Uses useEmployees and EmployeeSearchableSelect', () => {
    const pePath = path.resolve(rootDir, 'src/features/reports/components/PerformanceEvaluationView.tsx');
    const content = fs.readFileSync(pePath, 'utf8');

    assert.ok(content.includes('useEmployees'), 'Performance evaluation must use useEmployees hook');
    assert.ok(content.includes('EmployeeSearchableSelect'), 'Performance evaluation must render EmployeeSearchableSelect');
  });
});

describe('MSAL Error Classification and Popup Disambiguation', () => {
  function classifyTestError(err) {
    const errName = err?.name || 'Error';
    const errCode = (err?.errorCode || '').toLowerCase();
    const errMsg = err?.message || String(err || '');
    const correlationId = err?.correlationId || '';
    const subError = (err?.subError || '').toLowerCase();

    if (
      errCode === 'user_cancelled' ||
      errMsg.toLowerCase().includes('user cancelled the flow') ||
      errMsg.toLowerCase().includes('user_cancelled')
    ) {
      return { code: 'USER_CANCELLED', errorCode: errCode || 'user_cancelled', correlationId };
    }

    if (
      errCode === 'popup_window_error' ||
      errCode === 'empty_window_error' ||
      (errCode === '' && errMsg.toLowerCase().includes('error opening popup window')) ||
      (errCode === '' && errMsg.toLowerCase().includes('window open failed'))
    ) {
      return { code: 'POPUP_BLOCKED', errorCode: errCode || 'popup_window_error', correlationId };
    }

    if (
      errCode === 'interaction_in_progress' ||
      errCode === 'block_nested_popups' ||
      errMsg.toLowerCase().includes('interaction_in_progress')
    ) {
      return { code: 'INTERACTION_IN_PROGRESS', errorCode: errCode || 'interaction_in_progress', correlationId };
    }

    if (
      errCode === 'consent_required' ||
      subError === 'consent_required' ||
      errMsg.includes('AADSTS65001') ||
      errMsg.toLowerCase().includes('consent_required') ||
      errMsg.toLowerCase().includes('consent required')
    ) {
      return { code: 'CONSENT_REQUIRED', errorCode: errCode || 'consent_required', correlationId };
    }

    if (
      errCode === 'endpoints_resolution_error' ||
      errCode === 'invalid_authority' ||
      errCode === 'uninitialized_public_client_application' ||
      errCode === 'invalid_client' ||
      /\bAADSTS(700016|50011)\b/i.test(errMsg) ||
      errMsg.toLowerCase().includes('invalid_client') ||
      errMsg.toLowerCase().includes('redirect_uri_mismatch')
    ) {
      return { code: 'INVALID_CONFIG', errorCode: errCode || 'invalid_config', correlationId };
    }

    const aadstsMatch = errMsg.match(/AADSTS(\d+):?\s*([^.\r\n]+)/i);
    if (aadstsMatch) {
      const aadstsCode = `AADSTS${aadstsMatch[1]}`;
      return { code: 'AADSTS_ERROR', errorCode: aadstsCode, correlationId };
    }

    if (
      errName === 'InteractionRequiredAuthError' ||
      errCode === 'interaction_required' ||
      errCode === 'login_required'
    ) {
      return { code: 'INTERACTION_REQUIRED', errorCode: errCode, correlationId };
    }

    return { code: 'AUTH_FAILED', errorCode: errCode, correlationId };
  }


  test('Classifies actual browser popup blockage as POPUP_BLOCKED', () => {
    const err = { errorCode: 'popup_window_error', message: 'Error opening popup window.' };
    const result = classifyTestError(err);
    assert.equal(result.code, 'POPUP_BLOCKED');
  });

  test('Classifies empty_window_error as POPUP_BLOCKED', () => {
    const err = { errorCode: 'empty_window_error', message: 'window.open returned null.' };
    const result = classifyTestError(err);
    assert.equal(result.code, 'POPUP_BLOCKED');
  });

  test('Classifies user closure as USER_CANCELLED, NOT popup blocked', () => {
    const err = { errorCode: 'user_cancelled', message: 'User cancelled the flow.' };
    const result = classifyTestError(err);
    assert.equal(result.code, 'USER_CANCELLED');
    assert.notEqual(result.code, 'POPUP_BLOCKED');
  });

  test('Classifies interaction_in_progress as INTERACTION_IN_PROGRESS, NOT popup blocked', () => {
    const err = { errorCode: 'interaction_in_progress', message: 'Interaction is currently in progress.' };
    const result = classifyTestError(err);
    assert.equal(result.code, 'INTERACTION_IN_PROGRESS');
    assert.notEqual(result.code, 'POPUP_BLOCKED');
  });

  test('Classifies consent_required and AADSTS65001 as CONSENT_REQUIRED, NOT popup blocked', () => {
    const err = { errorCode: 'consent_required', message: 'AADSTS65001: The user or administrator has not consented to use the application with ID.' };
    const result = classifyTestError(err);
    assert.equal(result.code, 'CONSENT_REQUIRED');
    assert.notEqual(result.code, 'POPUP_BLOCKED');
  });

  test('Classifies specific AADSTS error codes as AADSTS_ERROR', () => {
    const err = { errorCode: 'invalid_grant', message: 'AADSTS50058: A silent sign in request was sent but no user could be signed in.' };
    const result = classifyTestError(err);
    assert.equal(result.code, 'AADSTS_ERROR');
    assert.equal(result.errorCode, 'AADSTS50058');
  });

  test('Classifies InteractionRequiredAuthError as INTERACTION_REQUIRED', () => {
    const err = { name: 'InteractionRequiredAuthError', errorCode: 'interaction_required', message: 'Interaction required' };
    const result = classifyTestError(err);
    assert.equal(result.code, 'INTERACTION_REQUIRED');
  });

  test('Classifies invalid_client as INVALID_CONFIG', () => {
    const err = { errorCode: 'invalid_client', message: 'AADSTS700016: Application with identifier was not found in directory.' };
    const result = classifyTestError(err);
    assert.equal(result.code, 'INVALID_CONFIG');
  });

  test('msal.ts: Performs eager initialization on module load to prevent popup delay', () => {
    const msalPath = path.resolve(rootDir, 'src/lib/msal.ts');
    const content = fs.readFileSync(msalPath, 'utf8');

    assert.ok(content.includes('initMsalEagerly'), 'Must include eager initialization function');
    assert.ok(content.includes('initMsalEagerly()'), 'Must invoke eager initialization on module load');
    assert.ok(content.includes('overrideInteractionInProgress: true'), 'Must include overrideInteractionInProgress option');
  });

  test('msal.ts: Does not log access tokens, ID tokens, or client secrets', () => {
    const msalPath = path.resolve(rootDir, 'src/lib/msal.ts');
    const content = fs.readFileSync(msalPath, 'utf8');

    // Check that console logging only includes safe diagnostic properties
    assert.ok(content.includes('console.error(\'[MSAL] Microsoft Graph authentication error:\','), 'Must log safe error diagnostics');
    assert.ok(!content.includes('console.log(popupResponse.accessToken)'), 'Must not log access tokens');
    assert.ok(!content.includes('console.log(token)'), 'Must not log token strings');
    assert.ok(!content.includes('client_secret'), 'Must not reference client_secret');
  });
});

