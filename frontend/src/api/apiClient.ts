import axios, { AxiosError } from 'axios';
import { showToast } from '../components/common/ToastHost';
import { getApiErrorMessage } from '../utils/apiError';

const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const apiClient = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // Always send cookies (HttpOnly auth cookies)
});

// ── Silent token refresh ───────────────────────────────────────────────────────
// When the 15-minute access token expires, automatically exchange the
// refresh token for a new pair before retrying the original request.

let isRefreshing = false;
let pendingQueue: Array<{ resolve: () => void; reject: (err: unknown) => void }> = [];

function drainQueue(error: unknown): void {
  pendingQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve()));
  pendingQueue = [];
}

apiClient.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const original = err.config as any;

    // Don't retry if: not a 401, already retried, or the failing call was itself a refresh/login
    const isRetryable =
      err.response?.status === 401 &&
      !original?._retry &&
      !original?.url?.includes('/auth/refresh') &&
      !original?.url?.includes('/auth/login');

    if (!isRetryable) {
      notifyMutationError(err);
      return Promise.reject(err);
    }

    if (isRefreshing) {
      // Queue concurrent requests to resume once the refresh completes
      return new Promise<void>((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      }).then(() => apiClient(original));
    }

    original._retry = true;
    isRefreshing = true;

    try {
      await apiClient.post('/auth/refresh');
      drainQueue(null);
      return apiClient(original);
    } catch (refreshErr) {
      drainQueue(refreshErr);
      // Both access and refresh tokens invalid — force logout
      window.dispatchEvent(new Event('crm:auth:logout'));
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  },
);

// ── Consistent user-facing error surfacing ─────────────────────────────────────
// Every failed mutation (POST/PUT/PATCH/DELETE) raises a toast with a friendly
// message, so a failure is never silent even when the calling component does
// not handle it. Auth endpoints keep their inline form errors, and 401s are
// owned by the silent-refresh flow above.
const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);

function notifyMutationError(err: AxiosError): void {
  const config = err.config as any;
  const method = (config?.method ?? '').toLowerCase();
  const url: string = config?.url ?? '';

  if (!MUTATING_METHODS.has(method)) return;      // reads fail quietly (views show their own states)
  if (url.includes('/auth/')) return;             // login/register/reset show inline errors
  if (err.response?.status === 401) return;       // handled by refresh/logout flow
  if (config?.skipErrorToast) return;             // caller opted out

  showToast({ kind: 'error', message: getApiErrorMessage(err) });
}

export default apiClient;
