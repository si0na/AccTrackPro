import {
  PublicClientApplication,
  type Configuration,
  type PopupRequest,
  InteractionRequiredAuthError,
  BrowserAuthError,
  type AccountInfo,
} from '@azure/msal-browser';

const clientId = (import.meta.env.VITE_AZURE_CLIENT_ID || '').trim();
const tenantId = (import.meta.env.VITE_AZURE_TENANT_ID || '').trim();

/**
 * Microsoft Graph delegated scopes for reading basic employee directory info.
 * Reads VITE_GRAPH_SCOPES from environment if provided, falling back strictly to User.ReadBasic.All.
 */
const envScopes = (import.meta.env.VITE_GRAPH_SCOPES || '')
  .split(',')
  .map((s: string) => s.trim())
  .filter(Boolean);

export const GRAPH_SCOPES: string[] =
  envScopes.length > 0 ? envScopes : ['https://graph.microsoft.com/User.ReadBasic.All'];

/**
 * Distinguishable authentication error types for Microsoft Graph integration.
 */
export type GraphAuthErrorCode =
  | 'NOT_CONFIGURED'
  | 'NO_ACTIVE_ACCOUNT'
  | 'INTERACTION_REQUIRED'
  | 'INTERACTION_IN_PROGRESS'
  | 'CONSENT_REQUIRED'
  | 'POPUP_BLOCKED'
  | 'USER_CANCELLED'
  | 'AADSTS_ERROR'
  | 'INVALID_CONFIG'
  | 'AUTH_FAILED';

export class GraphAuthError extends Error {
  public readonly code: GraphAuthErrorCode;
  public readonly originalError?: any;
  public readonly errorCode?: string;
  public readonly correlationId?: string;

  constructor(
    code: GraphAuthErrorCode,
    message: string,
    originalError?: any,
    options?: { errorCode?: string; correlationId?: string },
  ) {
    super(message);
    this.name = 'GraphAuthError';
    this.code = code;
    this.originalError = originalError;
    this.errorCode = options?.errorCode || originalError?.errorCode;
    this.correlationId = options?.correlationId || originalError?.correlationId;
  }
}


/**
 * Derives the canonical redirect URI with a trailing slash to prevent Entra AADSTS500113 errors.
 */
export function getRedirectUri(): string {
  const explicit = (import.meta.env.VITE_AZURE_REDIRECT_URI || '').trim();
  if (explicit) return explicit;

  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin.replace(/\/+$/, '')}/`;
  }

  return 'http://localhost:5173/';
}

export function isMsalConfigured(): boolean {
  return Boolean(clientId && tenantId);
}

export function createMsalConfig(): Configuration {
  if (!clientId) {
    throw new GraphAuthError(
      'NOT_CONFIGURED',
      'Microsoft Entra ID is not configured: VITE_AZURE_CLIENT_ID environment variable is missing.',
    );
  }

  if (!tenantId) {
    throw new GraphAuthError(
      'NOT_CONFIGURED',
      'Microsoft Entra ID is not configured: VITE_AZURE_TENANT_ID environment variable is missing.',
    );
  }

  const redirectUri = getRedirectUri();

  return {
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      redirectUri,
      postLogoutRedirectUri: redirectUri,
    },
    cache: {
      // Use sessionStorage — NEVER localStorage — to prevent persisting tokens across sessions
      cacheLocation: 'sessionStorage',
    },
  };
}

let pcaPromise: Promise<PublicClientApplication> | null = null;

export async function getMsalInstance(): Promise<PublicClientApplication> {
  if (!pcaPromise) {
    const config = createMsalConfig();
    const pca = new PublicClientApplication(config);
    pcaPromise = pca.initialize().then(async () => {
      try {
        const redirectRes = await pca.handleRedirectPromise();
        if (redirectRes?.account) {
          pca.setActiveAccount(redirectRes.account);
        }
      } catch (err) {
        console.warn('[MSAL] handleRedirectPromise error:', err);
      }
      return pca;
    });
  }
  return pcaPromise;
}

/**
 * Eagerly initializes the MSAL instance so that pca.initialize() and
 * handleRedirectPromise() are completed before any user clicks a connect button.
 */
export function initMsalEagerly(): Promise<PublicClientApplication | null> {
  if (typeof window !== 'undefined' && isMsalConfigured()) {
    return getMsalInstance().catch((err) => {
      console.warn('[MSAL] Eager initialization failed:', err);
      return null;
    });
  }
  return Promise.resolve(null);
}

// Eagerly initialize MSAL instance at module load
initMsalEagerly();


/**
 * Interactive login request for SSO, requesting basic OIDC identity plus delegated Graph scopes.
 */
export const loginRequest: PopupRequest = {
  scopes: ['openid', 'profile', 'email', ...GRAPH_SCOPES],
  prompt: 'select_account',
  overrideInteractionInProgress: true,
  get redirectUri() {
    return getRedirectUri();
  },
};

/**
 * Returns the currently active MSAL account or the first available account in the session.
 */
export async function getActiveMsalAccount(): Promise<AccountInfo | null> {
  if (!isMsalConfigured()) return null;
  try {
    const pca = await getMsalInstance();
    const active = pca.getActiveAccount();
    if (active) return active;
    const all = pca.getAllAccounts();
    if (all.length > 0) {
      pca.setActiveAccount(all[0]);
      return all[0];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Acquires a delegated access token for Microsoft Graph silently.
 *
 * CRITICAL LIFECYCLE RULE:
 * This method NEVER triggers interactive popups automatically.
 * It is called by background hooks and data loaders (e.g., useEmployees).
 * If no active account is connected or silent acquisition fails, it throws a
 * distinguishable GraphAuthError ('NO_ACTIVE_ACCOUNT' or 'INTERACTION_REQUIRED').
 */
export async function getGraphAccessToken(): Promise<string> {
  if (!isMsalConfigured()) {
    throw new GraphAuthError(
      'NOT_CONFIGURED',
      'Microsoft Entra ID is not configured (missing VITE_AZURE_CLIENT_ID or VITE_AZURE_TENANT_ID).',
    );
  }

  const pca = await getMsalInstance();
  const account = await getActiveMsalAccount();

  if (!account) {
    throw new GraphAuthError(
      'NO_ACTIVE_ACCOUNT',
      'No active Microsoft account connected. Connect Microsoft Employee Directory to sync.',
    );
  }

  try {
    const silentRes = await pca.acquireTokenSilent({
      scopes: GRAPH_SCOPES,
      account,
    });
    if (!silentRes?.accessToken) {
      throw new GraphAuthError('AUTH_FAILED', 'Silent token acquisition returned an empty token.');
    }
    return silentRes.accessToken;
  } catch (err: any) {
    if (
      err instanceof InteractionRequiredAuthError ||
      err?.name === 'InteractionRequiredAuthError' ||
      err?.errorCode === 'interaction_required' ||
      err?.errorCode === 'consent_required'
    ) {
      const code: GraphAuthErrorCode =
        err?.errorCode === 'consent_required' ? 'CONSENT_REQUIRED' : 'INTERACTION_REQUIRED';
      throw new GraphAuthError(
        code,
        'Microsoft authorization requires interactive sign-in or consent.',
        err,
      );
    }
    throw new GraphAuthError(
      'AUTH_FAILED',
      `Silent token acquisition failed: ${err?.message || 'Unknown error'}`,
      err,
    );
  }
}

/**
 * Classifies an error thrown during MSAL authentication into a typed GraphAuthError
 * with exact codes, safe diagnostic logging, and actionable user messages.
 */
export function classifyMsalAuthError(err: any): GraphAuthError {
  if (err instanceof GraphAuthError) {
    return err;
  }

  const errName = err?.name || 'Error';
  const errCode = (err?.errorCode || '').toLowerCase();
  const errMsg = err?.message || String(err || '');
  const correlationId = err?.correlationId || '';
  const subError = (err?.subError || '').toLowerCase();

  // Diagnostic logging (strictly excludes access tokens, ID tokens, secrets, or credentials)
  console.error('[MSAL] Microsoft Graph authentication error:', {
    name: errName,
    errorCode: errCode,
    message: errMsg,
    correlationId,
    subError,
  });

  // 1. User cancellation (closed popup without completing auth)
  if (
    errCode === 'user_cancelled' ||
    errMsg.toLowerCase().includes('user_cancelled') ||
    errMsg.toLowerCase().includes('user cancelled')
  ) {
    return new GraphAuthError(
      'USER_CANCELLED',
      'Microsoft sign-in was cancelled.',
      err,
      { errorCode: errCode || 'user_cancelled', correlationId },
    );
  }

  // 2. Genuine Browser Popup Blocking
  // Only popup_window_error and empty_window_error represent actual browser popup blockage
  if (
    errCode === 'popup_window_error' ||
    errCode === 'empty_window_error' ||
    (errCode === '' && errMsg.toLowerCase().includes('error opening popup window')) ||
    (errCode === '' && errMsg.toLowerCase().includes('window open failed'))
  ) {
    return new GraphAuthError(
      'POPUP_BLOCKED',
      'Login popup was blocked by your browser. Please allow popups for this site and try again.',
      err,
      { errorCode: errCode || 'popup_window_error', correlationId },
    );
  }

  // 3. Interaction in progress (another popup is open or unfinished interaction state)
  if (
    errCode === 'interaction_in_progress' ||
    errCode === 'block_nested_popups' ||
    errMsg.toLowerCase().includes('interaction_in_progress')
  ) {
    return new GraphAuthError(
      'INTERACTION_IN_PROGRESS',
      'Another Microsoft authentication window is already in progress. Please complete or close it and try again.',
      err,
      { errorCode: errCode || 'interaction_in_progress', correlationId },
    );
  }

  // 4. Missing Consent (tenant administrator or user consent required)
  if (
    errCode === 'consent_required' ||
    subError === 'consent_required' ||
    errMsg.includes('AADSTS65001') ||
    errMsg.toLowerCase().includes('consent_required') ||
    errMsg.toLowerCase().includes('consent required')
  ) {
    return new GraphAuthError(
      'CONSENT_REQUIRED',
      'Tenant administrator consent is required for Microsoft Graph User.ReadBasic.All permission. Please contact your Microsoft Entra administrator.',
      err,
      { errorCode: errCode || 'consent_required', correlationId },
    );
  }

  // 5. Invalid Configuration / Client ID / Authority / Redirect URI
  if (
    errCode === 'endpoints_resolution_error' ||
    errCode === 'invalid_authority' ||
    errCode === 'uninitialized_public_client_application' ||
    errCode === 'invalid_client' ||
    /\bAADSTS(700016|50011)\b/i.test(errMsg) ||
    errMsg.toLowerCase().includes('invalid_client') ||
    errMsg.toLowerCase().includes('redirect_uri_mismatch')
  ) {
    return new GraphAuthError(
      'INVALID_CONFIG',
      `Microsoft Entra configuration error (${errCode || errName}): ${errMsg}`,
      err,
      { errorCode: errCode || 'invalid_config', correlationId },
    );
  }

  // 6. Entra ID AADSTS Server Errors
  const aadstsMatch = errMsg.match(/AADSTS(\d+):?\s*([^.\r\n]+)/i);
  if (aadstsMatch) {
    const aadstsCode = `AADSTS${aadstsMatch[1]}`;
    const aadstsDetail = aadstsMatch[2] ? aadstsMatch[2].trim() : 'Microsoft Entra authentication failure';
    return new GraphAuthError(
      'AADSTS_ERROR',
      `Microsoft Entra ID error (${aadstsCode}): ${aadstsDetail}.`,
      err,
      { errorCode: aadstsCode, correlationId },
    );
  }

  // 7. Interaction Required (MFA, conditional access, password reset, or re-authentication)
  if (
    err instanceof InteractionRequiredAuthError ||
    errName === 'InteractionRequiredAuthError' ||
    errCode === 'interaction_required' ||
    errCode === 'login_required'
  ) {
    return new GraphAuthError(
      'INTERACTION_REQUIRED',
      'Microsoft sign-in requires additional interactive verification or re-authentication.',
      err,
      { errorCode: errCode, correlationId },
    );
  }


  // 8. General Authentication Failure (pass through actual message instead of generic popup message)
  return new GraphAuthError(
    'AUTH_FAILED',
    errMsg ? `Microsoft authentication failed: ${errMsg}` : 'Failed to authenticate with Microsoft Graph.',
    err,
    { errorCode: errCode, correlationId },
  );
}

/** In-flight lock to prevent multiple simultaneous popups */
let connectInProgress: Promise<{ account: AccountInfo; accessToken: string }> | null = null;

/**
 * Initiates an explicit interactive Microsoft authentication flow to connect the employee directory.
 *
 * MUST ONLY be called in response to a direct user action (e.g. clicking "Connect Microsoft Employee Directory").
 * Performs interactive loginPopup / acquireTokenPopup, sets the selected account as active,
 * and returns the authenticated account and access token.
 */
export async function connectGraphDirectory(): Promise<{ account: AccountInfo; accessToken: string }> {
  if (!isMsalConfigured()) {
    throw new GraphAuthError(
      'NOT_CONFIGURED',
      'Microsoft Entra ID is not configured: check VITE_AZURE_CLIENT_ID and VITE_AZURE_TENANT_ID in .env.',
    );
  }

  if (connectInProgress) {
    return connectInProgress;
  }

  connectInProgress = (async () => {
    const pca = await getMsalInstance();

    try {
      let account = await getActiveMsalAccount();

      // If no account exists in MSAL session, trigger interactive login popup
      if (!account) {
        const popupResponse = await pca.loginPopup(loginRequest);
        if (!popupResponse?.account) {
          throw new GraphAuthError('AUTH_FAILED', 'Microsoft authentication did not yield an active account.');
        }
        pca.setActiveAccount(popupResponse.account);
        account = popupResponse.account;

        // If loginPopup already yielded an access token with GRAPH_SCOPES, return immediately
        if (popupResponse.accessToken) {
          return { account, accessToken: popupResponse.accessToken };
        }
      }

      // First attempt silent acquisition with the active account
      try {
        const silentRes = await pca.acquireTokenSilent({
          scopes: GRAPH_SCOPES,
          account,
        });
        if (silentRes?.accessToken) {
          return { account, accessToken: silentRes.accessToken };
        }
      } catch (silentErr: any) {
        // Fall through to interactive popup if silent acquisition requires consent/interaction
      }

      // If silent acquisition failed with interaction/consent required, trigger acquireTokenPopup
      const popupRes = await pca.acquireTokenPopup({
        scopes: GRAPH_SCOPES,
        account,
        overrideInteractionInProgress: true,
      });

      if (!popupRes?.accessToken) {
        throw new GraphAuthError('AUTH_FAILED', 'Interactive token acquisition returned an empty token.');
      }

      if (popupRes.account) {
        pca.setActiveAccount(popupRes.account);
        account = popupRes.account;
      }

      return { account, accessToken: popupRes.accessToken };
    } catch (err: any) {
      throw classifyMsalAuthError(err);
    } finally {
      connectInProgress = null;
    }
  })();

  return connectInProgress;
}

/**
 * Disconnects the Microsoft account from the current MSAL session.
 */
export async function disconnectGraphDirectory(): Promise<void> {
  if (!isMsalConfigured()) return;
  try {
    const pca = await getMsalInstance();
    pca.setActiveAccount(null);
  } catch (err) {
    console.warn('[MSAL] disconnectGraphDirectory error:', err);
  }
}
