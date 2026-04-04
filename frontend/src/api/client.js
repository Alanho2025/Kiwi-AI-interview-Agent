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

  const defaultHeaders = {};
  if (!(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const config = {
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
    throw new Error(payload.error?.details || payload.message || payload.msg || 'API request failed');
  }

  return payload.data;
};
