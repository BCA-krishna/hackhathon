import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import { useAuth } from './context/AuthContext';
import Spinner from './components/Spinner';
import PrivateRoute from './components/PrivateRoute';
import AppVideoBackground from './components/AppVideoBackground';

const LoginPage = lazy(() => import('./pages/Login'));
const LandingPage = lazy(() => import('./pages/Landing'));
const DashboardPage = lazy(() => import('./pages/Dashboard'));
const AnalyticsPage = lazy(() => import('./pages/Analytics'));
const FeedbackInsightsPage = lazy(() => import('./pages/FeedbackInsights'));
const UploadDataPage = lazy(() => import('./pages/UploadData'));
const ForecastPage = lazy(() => import('./pages/Forecast'));
const AlertsPage = lazy(() => import('./pages/Alerts'));
const SettingsPage = lazy(() => import('./pages/Settings'));

function PublicRoute({ children }) {
  const { isAuthenticated, authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Checking authentication" />
      </div>
    );
  }

  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  const location = useLocation();
  const showVideoBackground = location.pathname !== '/';

  return (
    <div className="relative min-h-screen">
      {showVideoBackground ? <AppVideoBackground /> : null}

      <div className="relative z-10">
        <Suspense
          fallback={
            <div className="flex min-h-screen items-center justify-center">
              <Spinner label="Loading page" />
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<LandingPage />} />

            <Route
              path="/login"
              element={
                <PublicRoute>
                  <LoginPage />
                </PublicRoute>
              }
            />

            <Route
              element={
                <PrivateRoute>
                  <AppLayout />
                </PrivateRoute>
              }
            >
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/feedback-insights" element={<FeedbackInsightsPage />} />
              <Route path="/upload" element={<UploadDataPage />} />
              <Route path="/forecast" element={<ForecastPage />} />
              <Route path="/alerts" element={<AlertsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </div>
    </div>
  );
}
