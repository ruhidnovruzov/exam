import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { fetchCurrentUser, isAuthenticated, logout } from '../services/auth';

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      if (!isAuthenticated()) {
        setAllowed(false);
        setChecking(false);
        return;
      }

      try {
        const user = await fetchCurrentUser();
        if (user.rol === 'STUDENT') {
          logout();
          setAllowed(false);
        } else {
          setAllowed(true);
        }
      } catch {
        logout();
        setAllowed(false);
      } finally {
        setChecking(false);
      }
    };

    checkAccess();
  }, []);

  if (checking) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">Yoxlanılır...</div>;
  }

  if (!allowed) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
