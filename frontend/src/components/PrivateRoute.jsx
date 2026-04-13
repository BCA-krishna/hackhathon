import { Navigate } from 'react-router-dom';
import Spinner from './Spinner';
import { useAuth } from '../context/AuthContext';

export default function PrivateRoute({ children }) {
  const { isAuthenticated, authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Checking authentication" />
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}
