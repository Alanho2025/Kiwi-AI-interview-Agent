import { apiClient } from './client.js';

export const uploadCV = (file) => {
  const formData = new FormData();
  formData.append('cv', file);
  return apiClient('/upload/cv', { method: 'POST', body: formData });
};

export const getRecentCVs = () => apiClient('/upload/recent-cvs');
export const selectCV = (cvId) => apiClient('/upload/select-cv', { method: 'POST', body: { cvId } });
