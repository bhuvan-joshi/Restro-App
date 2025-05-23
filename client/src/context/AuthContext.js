import React, { createContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// Get API URL from environment variable or use default
const API_URL = process.env.REACT_APP_API_URL || '/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const logout = useCallback(() => {
    // Remove token from localStorage
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    
    // Remove auth header
    delete axios.defaults.headers.common['x-auth-token'];
  }, []);
  
  const fetchUserData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/users/me`);
      setUser(res.data);
    } catch (err) {
      console.error('Error fetching user data:', err);
      logout();
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    // If token exists, set auth header and fetch user data
    if (token) {
      axios.defaults.headers.common['x-auth-token'] = token;
      fetchUserData();
    } else {
      setLoading(false);
    }
  }, [token, fetchUserData]);

  const login = async (username, password) => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.post(`${API_URL}/users/login`, { username, password });
      const { token: newToken, user: userData } = res.data;
      
      // Save token to localStorage
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(userData);
      
      // Set auth header
      axios.defaults.headers.common['x-auth-token'] = newToken;
      
      setLoading(false);
      return true;
    } catch (err) {
      setError(
        err.response && err.response.data.message
          ? err.response.data.message
          : 'Login failed. Please check your credentials.'
      );
      setLoading(false);
      return false;
    }
  };


  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        error,
        login,
        logout,
        fetchUserData
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}; 