import { getStoredAuthSession } from '../utils/authSession.js';
import { clearStoredAuthSession } from '../utils/authSession.js';

const normalizeBaseUrl = (value) => {
  if (!value) {
    return '/api';
  }

  return value.replace(/\/+$/, '');
};

export const apiClient = async (endpoint, options = {}) => {
  const baseUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL);
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}${normalizedEndpoint}`;
  const authSession = getStoredAuthSession();

  const defaultHeaders = {};
  if (!(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }
  if (authSession?.token) {
    defaultHeaders.Authorization = `Bearer ${authSession.token}`;
  }

  const config = {
    credentials: 'include',
    ...options,
    headers: {
      ...defaultHeaders,
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
    if (response.status === 401) {
      clearStoredAuthSession();
    }
    throw new Error(payload.error?.details || payload.message || payload.msg || 'API request failed');
  }

  return payload.data;
};


export const apiGet = (endpoint, options = {}) => apiClient(endpoint, { method: 'GET', ...options });
export const apiPost = (endpoint, body, options = {}) => apiClient(endpoint, { method: 'POST', body, ...options });
