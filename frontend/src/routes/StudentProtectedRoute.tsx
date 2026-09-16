import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { isStudentAuthenticated } from '../services/studentAuth';

interface StudentProtectedRouteProps {
  children: ReactNode;
}

const StudentProtectedRoute = ({ children }: StudentProtectedRouteProps) => {
  if (!isStudentAuthenticated()) {
    return <Navigate to="/student/login" replace />;
  }

  return children;
};

export default StudentProtectedRoute;
