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

const AUTH_TOKEN_STORAGE_KEY = 'kiwi_auth_token';
const LEGACY_AUTH_TOKEN_STORAGE_KEY = 'authToken';

/**
 * Read the stored JWT fallback token for browsers that block cross-site cookies.
 */
export const getStoredAuthToken = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  return (
    window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) ||
    window.localStorage.getItem(LEGACY_AUTH_TOKEN_STORAGE_KEY) ||
    ''
  );
};

/**
 * Store the JWT fallback token after a successful login.
 */
export const storeAuthToken = (token) => {
  if (typeof window === 'undefined' || !token) {
    return;
  }

  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  window.localStorage.removeItem(LEGACY_AUTH_TOKEN_STORAGE_KEY);
};

/**
 * Clear all known browser-side auth token keys during logout.
 */
export const clearStoredAuthToken = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_AUTH_TOKEN_STORAGE_KEY);
};

/**
 * Build Authorization headers only when a fallback token exists.
 */
const buildAuthHeaders = () => {
  const token = getStoredAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
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

  const defaultHeaders = {};
  if (!(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const config = {
    credentials: 'include',
    ...options,
    headers: {
      ...defaultHeaders,
      ...buildAuthHeaders(),
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

  const defaultHeaders = {};
  if (!(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const config = {
    credentials: 'include',
    ...options,
    headers: {
      ...defaultHeaders,
      ...buildAuthHeaders(),
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
