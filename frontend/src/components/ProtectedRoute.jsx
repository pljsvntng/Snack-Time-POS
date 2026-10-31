import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Wrap a route element: requires login, and optionally a specific role.
// Usage: <ProtectedRoute roles={['admin']}><Products /></ProtectedRoute>
export default function ProtectedRoute({ children, roles }) {
  const { user, initializing } = useAuth();
  if (initializing) return <div className="empty-state">Opening secure local storage...</div>;

  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/pos" replace />;

  return children;
}
