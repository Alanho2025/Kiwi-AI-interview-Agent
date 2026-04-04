import { apiClient } from './client.js';

export const getGoogleClientConfig = async () =>
  apiClient('/auth/google/config', {
    credentials: 'include',
  });

export const loginWithGoogle = async (idToken) =>
  apiClient('/auth/google', {
    method: 'POST',
    body: { idToken },
    credentials: 'include',
  });

export const logoutFromSession = async () =>
  apiClient('/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
