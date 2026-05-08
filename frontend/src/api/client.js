/**
 * File responsibility: Shared API client and URL builders.
 * Main responsibilities:
 * - Keep HTTP requests pointed at the backend /api namespace in every environment.
 * - Keep credentials included for cookie-based auth.
 * - Build matching WebSocket URLs for voice interview endpoints.
 * Maintenance notes:
 * - VITE_API_BASE_URL should normally be the backend origin only, without /api.
 * - The helpers below also tolerate an env value that already includes /api.
 */

const API_NAMESPACE = '/api';

const CSRF_HEADER_NAME = 'X-CSRF-Token';
const AUTH_TOKEN_STORAGE_KEYS = ['kiwi_auth_token', 'authToken'];

let csrfToken = '';
let csrfTokenPromise = null;

/**
 * Clear legacy browser-side auth token keys during logout.
 */
export const clearStoredAuthToken = () => {
  if (typeof window === 'undefined') {
    return;
  }

  AUTH_TOKEN_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
};

/**
 * Clear the in-memory CSRF token when the session changes.
 */
export const clearCsrfToken = () => {
  csrfToken = '';
  csrfTokenPromise = null;
};

/**
 * Remove trailing slashes from a URL-like value.
 */
const trimTrailingSlashes = (value) => String(value || '').replace(/\/+$/, '');

/**
 * Remove leading slashes from an endpoint path.
 */
const trimLeadingSlashes = (value) => String(value || '').replace(/^\/+/, '');

/**
 * Resolve the configured backend origin.
 * In local development, an empty env value keeps using Vite's /api proxy.
 */
export const getApiOrigin = () => trimTrailingSlashes(import.meta.env.VITE_API_BASE_URL || '');

/**
 * Normalize the configured backend URL so HTTP calls always include /api.
 */
export const normalizeBaseUrl = (value) => {
  const trimmedValue = trimTrailingSlashes(value);

  if (!trimmedValue) {
    return API_NAMESPACE;
  }

  if (trimmedValue.endsWith(API_NAMESPACE)) {
    return trimmedValue;
  }

  return `${trimmedValue}${API_NAMESPACE}`;
};

/**
 * Build a full API URL for fetch requests.
 */
export const buildApiUrl = (endpoint = '') => {
  const baseUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL);
  const cleanEndpoint = trimLeadingSlashes(endpoint);
  return cleanEndpoint ? `${baseUrl}/${cleanEndpoint}` : baseUrl;
};

const isUnsafeMethod = (method = 'GET') =>
  !['GET', 'HEAD', 'OPTIONS'].includes(String(method || 'GET').toUpperCase());

const loadCsrfToken = async () => {
  if (csrfToken) {
    return csrfToken;
  }

  if (!csrfTokenPromise) {
    csrfTokenPromise = fetch(buildApiUrl('/auth/csrf'), {
      method: 'GET',
      credentials: 'include',
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error?.details || payload.message || payload.msg || 'Could not load CSRF token');
        }
        csrfToken = payload.data?.csrfToken || '';
        return csrfToken;
      })
      .finally(() => {
        csrfTokenPromise = null;
      });
  }

  return csrfTokenPromise;
};

const buildCsrfHeaders = async (method) => {
  if (!isUnsafeMethod(method)) {
    return {};
  }

  const token = await loadCsrfToken();
  return token ? { [CSRF_HEADER_NAME]: token } : {};
};

/**
 * Build a full backend WebSocket URL for voice requests.
 */
export const buildApiWebSocketUrl = (endpoint = '') => {
  const apiBaseUrl = buildApiUrl(endpoint);
  const absoluteUrl = apiBaseUrl.startsWith('http')
    ? new URL(apiBaseUrl)
    : new URL(apiBaseUrl, window.location.origin);

  absoluteUrl.protocol = absoluteUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  return absoluteUrl;
};

/**
 * Execute a JSON or FormData API request.
 */
export const apiClient = async (endpoint, options = {}) => {
  const url = buildApiUrl(endpoint);
  const method = options.method || 'GET';

  const defaultHeaders = {};
  if (!(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const config = {
    credentials: 'include',
    ...options,
    headers: {
      ...defaultHeaders,
      ...(await buildCsrfHeaders(method)),
      ...options.headers,
    },
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : { message: await response.text() };

  if (!response.ok) {
    throw new Error(payload.error?.details || payload.message || payload.msg || 'API request failed');
  }

  return payload.data;
};

export const apiGet = (endpoint, options = {}) => apiClient(endpoint, { method: 'GET', ...options });
export const apiPost = (endpoint, body, options = {}) => apiClient(endpoint, { method: 'POST', body, ...options });

/**
 * Execute an API request that returns a stream response.
 */
export const apiClientStream = async (endpoint, options = {}) => {
  const url = buildApiUrl(endpoint);
  const method = options.method || 'GET';

  const defaultHeaders = {};
  if (!(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const config = {
    credentials: 'include',
    ...options,
    headers: {
      ...defaultHeaders,
      ...(await buildCsrfHeaders(method)),
      ...options.headers,
    },
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Stream request failed: ${response.status} ${text}`);
  }
  return response;
};
