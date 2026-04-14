import { createContext, useContext, useState, useCallback } from 'react';

const AnalyticsContext = createContext();

export function AnalyticsProvider({ children }) {
  const [cachedAnalytics, setCachedAnalytics] = useState(null);

  const updateAnalytics = useCallback((data) => {
    setCachedAnalytics((prev) => ({
      ...prev,
      ...data,
      timestamp: new Date().toISOString()
    }));
  }, []);

  const clearAnalytics = useCallback(() => {
    setCachedAnalytics(null);
  }, []);

  return (
    <AnalyticsContext.Provider
      value={{
        cachedAnalytics,
        updateAnalytics,
        clearAnalytics
      }}
    >
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics() {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalytics must be used within an AnalyticsProvider');
  }
  return context;
}
