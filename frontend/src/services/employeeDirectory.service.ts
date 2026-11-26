import {
  getGraphAccessToken,
  connectGraphDirectory,
  getActiveMsalAccount,
  isMsalConfigured,
  GraphAuthError,
} from '@/lib/msal';
import type { EmployeeDirectoryUser, DirectorySource } from '@/types';

/**
 * Microsoft Graph users query URL strictly requesting properties permitted by User.ReadBasic.All.
 * Uses maximum page size ($top=999) to minimize round-trips.
 */
const GRAPH_USERS_ENDPOINT =
  'https://graph.microsoft.com/v1.0/users?$select=id,displayName,givenName,surname,mail,userPrincipalName&$top=999';

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_THROTTLE_RETRIES = 3;

/**
 * Distinguishable error codes for Microsoft Graph Employee Directory integration.
 */
export type GraphDirectoryErrorCode =
  | 'NO_ACCOUNT_CONNECTED'
  | 'INTERACTION_REQUIRED'
  | 'CONSENT_MISSING'
  | 'INVALID_TOKEN'
  | 'HTTP_401'
  | 'HTTP_403'
  | 'HTTP_429'
  | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE'
  | 'EMPTY_DIRECTORY';

export class GraphDirectoryError extends Error {
  public readonly code: GraphDirectoryErrorCode;
  public readonly httpStatus?: number;
  public readonly originalError?: any;

  constructor(
    code: GraphDirectoryErrorCode,
    message: string,
    httpStatus?: number,
    originalError?: any,
  ) {
    super(message);
    this.name = 'GraphDirectoryError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.originalError = originalError;
  }
}

export interface EmployeeDirectoryResult {
  employees: EmployeeDirectoryUser[];
  source: DirectorySource;
  fallbackReason?: string | null;
  error?: GraphDirectoryError | null;
  lastSyncTime?: number | null;
}

interface CacheState {
  employees: EmployeeDirectoryUser[];
  timestamp: number;
  source: DirectorySource;
  fallbackReason?: string | null;
  error?: GraphDirectoryError | null;
}

export class EmployeeDirectoryService {
  private cache: CacheState | null = null;
  private inFlightPromise: Promise<EmployeeDirectoryResult> | null = null;

  /**
   * Normalizes a raw Graph user item to a clean EmployeeDirectoryUser.
   * Uses displayName for employee name, mail as preferred email with fallback to userPrincipalName.
   */
  public normalizeGraphUser(raw: any): EmployeeDirectoryUser {
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

  /**
   * Fetches all accessible employees from Microsoft Graph via delegated token.
   * Traverses all `@odata.nextLink` pages until complete.
   * Handles 429 throttling with Retry-After and 401 token expiry retry.
   * Throws typed GraphDirectoryError with distinct error codes.
   */
  public async fetchAllFromGraph(): Promise<EmployeeDirectoryUser[]> {
    let token: string;
    try {
      token = await getGraphAccessToken();
    } catch (authErr: any) {
      if (authErr instanceof GraphAuthError) {
        if (authErr.code === 'NO_ACTIVE_ACCOUNT') {
          throw new GraphDirectoryError('NO_ACCOUNT_CONNECTED', authErr.message, undefined, authErr);
        }
        if (authErr.code === 'INTERACTION_REQUIRED') {
          throw new GraphDirectoryError('INTERACTION_REQUIRED', authErr.message, undefined, authErr);
        }
        if (authErr.code === 'CONSENT_REQUIRED') {
          throw new GraphDirectoryError('CONSENT_MISSING', authErr.message, undefined, authErr);
        }
        throw new GraphDirectoryError('INVALID_TOKEN', authErr.message, undefined, authErr);
      }
      throw new GraphDirectoryError('INVALID_TOKEN', authErr?.message || 'Authentication failed', undefined, authErr);
    }

    let nextUrl: string | null = GRAPH_USERS_ENDPOINT;
    const allUsers: EmployeeDirectoryUser[] = [];
    const seenIds = new Set<string>();

    while (nextUrl) {
      let retries = 0;
      let pageData: any = null;

      while (retries <= MAX_THROTTLE_RETRIES) {
        let res: Response;
        try {
          res = await fetch(nextUrl, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
              ConsistencyLevel: 'eventual',
            },
          });
        } catch (netErr: any) {
          throw new GraphDirectoryError(
            'NETWORK_ERROR',
            `Network failure connecting to Microsoft Graph: ${netErr.message}`,
            undefined,
            netErr,
          );
        }

        // Handle 401 Unauthorized — attempt single token refresh
        if (res.status === 401 && retries === 0) {
          try {
            token = await getGraphAccessToken();
            retries++;
            continue;
          } catch (refreshErr: any) {
            throw new GraphDirectoryError(
              'HTTP_401',
              'Microsoft Graph request unauthorized (HTTP 401). Token expired or invalid.',
              401,
              refreshErr,
            );
          }
        }

        // Handle 429 Too Many Requests — obey Retry-After header with exponential backoff
        if (res.status === 429) {
          retries++;
          if (retries > MAX_THROTTLE_RETRIES) {
            throw new GraphDirectoryError(
              'HTTP_429',
              'Microsoft Graph rate limit reached (HTTP 429). Please retry shortly.',
              429,
            );
          }
          const retryAfterSec = parseInt(res.headers.get('Retry-After') || '2', 10);
          const waitMs = (isNaN(retryAfterSec) || retryAfterSec <= 0 ? Math.pow(2, retries) : retryAfterSec) * 1000;
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }

        // Handle 403 Forbidden
        if (res.status === 403) {
          throw new GraphDirectoryError(
            'HTTP_403',
            'Access denied by Microsoft Entra ID (HTTP 403). Ensure User.ReadBasic.All delegated permission is granted and consented by an administrator.',
            403,
          );
        }

        if (!res.ok) {
          const errorBody = await res.text().catch(() => '');
          throw new GraphDirectoryError(
            'INVALID_RESPONSE',
            `Microsoft Graph request failed with status ${res.status}: ${errorBody || res.statusText}`,
            res.status,
          );
        }

        try {
          pageData = await res.json();
        } catch (jsonErr: any) {
          throw new GraphDirectoryError(
            'INVALID_RESPONSE',
            'Failed to parse JSON response from Microsoft Graph.',
            res.status,
            jsonErr,
          );
        }
        break;
      }

      if (!pageData) {
        throw new GraphDirectoryError('INVALID_RESPONSE', 'Failed to retrieve response data from Microsoft Graph.');
      }

      const usersBatch: any[] = Array.isArray(pageData.value) ? pageData.value : [];
      for (const item of usersBatch) {
        if (!item || !item.id) continue;
        if (seenIds.has(item.id)) continue;
        seenIds.add(item.id);
        allUsers.push(this.normalizeGraphUser(item));
      }

      // Follow exact @odata.nextLink returned by Microsoft Graph
      nextUrl = pageData['@odata.nextLink'] || null;
    }

    return allUsers;
  }

  /**
   * Retrieves the employee directory exclusively from Microsoft Graph.
   * Under strict security and single-source requirements:
   * - Does NOT fetch from local backend employee endpoints.
   * - Does NOT merge with ReflectOne `users` or `employee_master`.
   * - Does NOT fall back to local database tables when unauthenticated or offline.
   * - Returns clear status/error information when Microsoft Graph is disconnected or unavailable.
   */
  public async getEmployees(forceRefresh = false): Promise<EmployeeDirectoryResult> {
    const now = Date.now();
    if (!forceRefresh && this.cache && now - this.cache.timestamp < CACHE_TTL_MS) {
      return {
        employees: this.cache.employees,
        source: this.cache.source,
        fallbackReason: this.cache.fallbackReason,
        error: this.cache.error,
        lastSyncTime: this.cache.timestamp,
      };
    }

    if (this.inFlightPromise) {
      return this.inFlightPromise;
    }

    this.inFlightPromise = (async (): Promise<EmployeeDirectoryResult> => {
      let statusMessage: string | null = null;
      let graphError: GraphDirectoryError | null = null;

      // 1. Verify Microsoft Entra configuration
      if (!isMsalConfigured()) {
        statusMessage = 'Microsoft Entra ID is not configured in environment (missing client or tenant ID).';
        graphError = new GraphDirectoryError('NOT_CONFIGURED' as any, statusMessage);
        return {
          employees: [],
          source: 'disconnected',
          fallbackReason: statusMessage,
          error: graphError,
          lastSyncTime: this.cache?.timestamp || null,
        };
      }

      // 2. Check for active MSAL session
      const activeAccount = await getActiveMsalAccount();
      if (!activeAccount) {
        statusMessage = 'Not connected to Microsoft Entra Directory. Connect Microsoft Employee Directory to sync.';
        graphError = new GraphDirectoryError('NO_ACCOUNT_CONNECTED', statusMessage);
        return {
          employees: [],
          source: 'disconnected',
          fallbackReason: statusMessage,
          error: graphError,
          lastSyncTime: this.cache?.timestamp || null,
        };
      }

      // 3. Fetch from Microsoft Graph
      try {
        const graphUsers = await this.fetchAllFromGraph();
        this.cache = {
          employees: graphUsers,
          timestamp: Date.now(),
          source: 'microsoft_graph',
          fallbackReason: null,
          error: null,
        };
        return {
          employees: graphUsers,
          source: 'microsoft_graph',
          fallbackReason: null,
          error: null,
          lastSyncTime: this.cache.timestamp,
        };
      } catch (err: any) {
        graphError =
          err instanceof GraphDirectoryError
            ? err
            : new GraphDirectoryError('NETWORK_ERROR', err?.message || 'Microsoft Graph sync failed', undefined, err);

        statusMessage = graphError.message;
        console.warn(`[EmployeeDirectoryService] Microsoft Graph sync failed (${graphError.code}): ${graphError.message}`);

        return {
          employees: this.cache ? this.cache.employees : [],
          source: this.cache ? 'microsoft_graph' : 'disconnected',
          fallbackReason: statusMessage,
          error: graphError,
          lastSyncTime: this.cache?.timestamp || null,
        };
      }
    })();

    try {
      return await this.inFlightPromise;
    } finally {
      this.inFlightPromise = null;
    }
  }

  /**
   * Explicitly connects the Microsoft account via interactive authentication and loads the directory.
   * Clears existing cache and forces a fresh load from Microsoft Graph.
   */
  public async connectAndFetch(): Promise<EmployeeDirectoryResult> {
    await connectGraphDirectory();
    this.clearCache();
    const result = await this.getEmployees(true);
    if (result.error) {
      throw result.error;
    }
    return result;
  }

  /**
   * Returns the timestamp of the last successful synchronization from Microsoft Graph.
   */
  public getLastSyncTime(): number | null {
    return this.cache?.timestamp || null;
  }

  /**
   * Checks whether an active MSAL account is currently connected in the session.
   */
  public async isConnectedToGraph(): Promise<boolean> {
    const account = await getActiveMsalAccount();
    return Boolean(account);
  }

  /**
   * Clears the in-memory cache to force an immediate reload on subsequent request.
   */
  public clearCache(): void {
    this.cache = null;
  }

  /**
   * Client-side fast search over directory users by name or email.
   * Limits results to maxResults for smooth rendering with large directories.
   */
  public search(
    query: string,
    employees: EmployeeDirectoryUser[],
    maxResults = 50,
  ): EmployeeDirectoryUser[] {
    const q = (query || '').trim().toLowerCase();
    if (!q) {
      return employees.slice(0, maxResults);
    }

    const matches: EmployeeDirectoryUser[] = [];
    for (const emp of employees) {
      const nameMatch = emp.displayName.toLowerCase().includes(q);
      const emailMatch =
        (emp.email || '').toLowerCase().includes(q) ||
        (emp.userPrincipalName || '').toLowerCase().includes(q);
      if (nameMatch || emailMatch) {
        matches.push(emp);
        if (matches.length >= maxResults) break;
      }
    }
    return matches;
  }

  /**
   * Looks up an employee by stable Microsoft Graph user ID or local employee ID.
   */
  public findById(id: string, employees: EmployeeDirectoryUser[]): EmployeeDirectoryUser | undefined {
    if (!id) return undefined;
    return employees.find((emp) => emp.id === id || emp.localEmployeeId === id);
  }
}

export const employeeDirectoryService = new EmployeeDirectoryService();
