/**
 * File responsibility: Application module.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: client should keep its module boundaries clear and focused.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { getStoredAuthSession } from '../utils/authSession.js';
import { clearStoredAuthSession } from '../utils/authSession.js';

/**
 * Purpose: Execute the main responsibility for normalizeBaseUrl.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const normalizeBaseUrl = (value) => {
  if (!value) {
    return '/api';
  }

  return value.replace(/\/+$/, '');
};

/**
 * Purpose: Execute the main responsibility for apiClient.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
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


/**
 * Purpose: Execute the main responsibility for apiGet.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const apiGet = (endpoint, options = {}) => apiClient(endpoint, { method: 'GET', ...options });
export const apiPost = (endpoint, body, options = {}) => apiClient(endpoint, { method: 'POST', body, ...options });
