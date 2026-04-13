import axios from 'axios';
import { auth } from './firebase';

const api = axios.create({
  baseURL: 'http://localhost:5000/api'
});

api.interceptors.request.use(async (config) => {
  const token = await auth.currentUser?.getIdToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const decisionApi = {
  uploadData: (payload) => api.post('/upload-data', payload),
  uploadFile: (formData, onUploadProgress) =>
    api.post('/upload-data', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress
    }),
  getInsights: () => api.get('/insights'),
  getForecast: () => api.get('/forecast'),
  getAlerts: () => api.get('/alerts'),
  getRecommendations: () => api.get('/recommendations')
};

export default api;
