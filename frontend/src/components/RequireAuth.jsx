import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import LoadingSpinner from '../components/ui/LoadingSpinner.jsx';

function RequireAuth({ roles, children }) {
  const { isAuthenticated, isLoading, role } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingSpinner label="Restoring your session" />;
  if (!isAuthenticated) {
    const target = roles?.includes('ADMIN') ? '/admin/login' : '/login';
    return <Navigate to={target} replace state={{ from: location.pathname + location.search }} />;
  }
  if (roles && !roles.includes(role)) return <Navigate to="/" replace />;
  return children;
}

export default RequireAuth;
