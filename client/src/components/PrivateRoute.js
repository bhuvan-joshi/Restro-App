import React, { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const PrivateRoute = ({ requiredRole }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return <div className="text-center mt-5">Loading...</div>;
  }

  // Check if user is authenticated
  if (!user) {
    return <Navigate to="/login" />;
  }

  // If requiredRole is specified, check if user has the required role
  if (requiredRole && user.role !== requiredRole) {
    // For admin-only routes
    if (requiredRole === 'admin' && user.role !== 'admin') {
      return <Navigate to="/dashboard" />;
    }
    
    // For admin or manager routes
    if (requiredRole === 'manager' && user.role !== 'admin' && user.role !== 'manager') {
      return <Navigate to="/dashboard" />;
    }
  }

  return <Outlet />;
};

export default PrivateRoute; 