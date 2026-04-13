// Backend API layer intentionally disabled. The app now uses Firebase SDK directly.
function disabledApiCall() {
  return Promise.reject(new Error('Backend API disabled. Use Firebase services directly.'));
}

export const decisionApi = {
  uploadData: disabledApiCall,
  uploadFile: disabledApiCall,
  getInsights: disabledApiCall,
  getForecast: disabledApiCall,
  getAlerts: disabledApiCall,
  getRecommendations: disabledApiCall
};

export default {
  get: disabledApiCall,
  post: disabledApiCall,
  put: disabledApiCall,
  patch: disabledApiCall,
  delete: disabledApiCall
};
