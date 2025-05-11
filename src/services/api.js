import axios from 'axios';

// Updated to match the .NET Core backend port
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5122/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for adding the auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor for handling common errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      // Handle 401 Unauthorized by redirecting to login
      if (error.response.status === 401) {
        console.warn('Authentication error - token may be invalid or expired');
        
        // Only redirect if we're not already on the login page
        if (!window.location.pathname.includes('/login')) {
          console.log('Redirecting to login page...');
          // Clear auth data
          localStorage.removeItem('auth_token');
          window.location.href = '/login';
        }
      }
    } else if (error.request) {
      console.error('API Error: No response received', error.request);
    } else {
      console.error('API Error:', error.message);
    }
    return Promise.reject(error);
  }
);

// Auth API
export const login = (email, password) => {
  return api.post('/auth/login', { email, password });
};

export const register = (username, email, password) => {
  return api.post('/auth/register', { username, email, password });
};

export const getCurrentUser = () => {
  return api.get('/auth/me');
};

export const changePassword = (oldPassword, newPassword) => {
  return api.post('/auth/change-password', { oldPassword, newPassword });
};

// Widget Settings API
export const getUserWidgets = () => {
  return api.get('/widgetsettings');
};

export const getWidget = (id) => {
  return api.get(`/widgetsettings/${id}`);
};

export const createWidget = (widgetData) => {
  return api.post('/widgetsettings', widgetData);
};

export const updateWidget = (id, widgetData) => {
  return api.put(`/widgetsettings/${id}`, widgetData);
};

export const deleteWidget = (id) => {
  return api.delete(`/widgetsettings/${id}`);
};

export const getPublicWidget = (id) => {
  return api.get(`/widgetsettings/public/${id}`);
};

export const saveStripeSettings = (settings) => {
  return api.post('/widgetsettings/settings/stripe', settings);
};

export const savePayPalSettings = (settings) => {
  return api.post('/widgetsettings/settings/paypal', settings);
};

// Chat API
export const getUserSessions = () => {
  return api.get('/chat/sessions');
};

export const getSession = (id) => {
  return api.get(`/chat/sessions/${id}`);
};

export const createSession = (widgetId, userData = {}) => {
  return api.post('/chat/sessions', {
    widgetId,
    userLocation: userData.location,
    userDevice: userData.device,
    referrerUrl: userData.referrer,
  });
};

export const sendMessage = (sessionId, content, isFromUser = true) => {
  return api.post('/chat/messages', { sessionId, content, isFromUser });
};

export const endSession = (id) => {
  return api.post(`/chat/sessions/${id}/end`);
};

// Public Chat API (no auth)
export const createPublicSession = (widgetId, userData = {}) => {
  return api.post('/chat/public/sessions', {
    widgetId,
    userLocation: userData.location,
    userDevice: userData.device,
    referrerUrl: userData.referrer,
  });
};

export const getPublicSession = (id) => {
  return api.get(`/chat/public/sessions/${id}`);
};

export const sendPublicMessage = (sessionId, content, isFromUser = true) => {
  return api.post('/chat/public/messages', { sessionId, content, isFromUser });
};

// Documents API
export const getDocuments = () => {
  return api.get('/documents');
};

export const getDocument = (id) => {
  return api.get(`/documents/${id}`);
};

export const uploadDocument = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/documents/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

export const deleteDocument = (id) => {
  return api.delete(`/documents/${id}`);
};

// Payment API
export const createStripeSession = (sessionData) => {
  return api.post('/payments/stripe/create-session', sessionData);
};

export const createPayPalOrder = (orderData) => {
  return api.post('/payments/paypal/create-order', orderData);
};

export const capturePayPalOrder = (orderId) => {
  return api.post('/payments/paypal/capture-order', { orderId });
};

export const cancelSubscription = () => {
  return api.post('/payments/cancel-subscription');
};

export const updatePaymentInfo = () => {
  return api.post('/payments/update-payment-info');
};

export const getSubscriptionStatus = () => {
  return api.get('/payments/subscription-status');
};

// User API
export const updateUserProfile = (profileData) => {
  return api.put('/users/profile', profileData);
};

export const getUserStats = () => {
  return api.get('/users/stats');
};

// Admin API
export const getAllUsers = (page = 1, limit = 10) => {
  return api.get(`/admin/users?page=${page}&limit=${limit}`);
};

export const getUserDetails = (userId) => {
  return api.get(`/admin/users/${userId}`);
};

export const updateUserStatus = (userId, status) => {
  return api.put(`/admin/users/${userId}/status`, { status });
};

export const getSystemStats = () => {
  return api.get('/admin/stats');
};

export const getSystemLogs = (page = 1, limit = 50) => {
  return api.get(`/admin/logs?page=${page}&limit=${limit}`);
};

// Debug API
export const debugWidgetData = (widgetData) => {
  return api.post('/widgetsettings/debug', widgetData);
};

export const downloadDocument = async (id) => {
  try {
    const response = await api.get(`/documents/${id}/download`, {
      responseType: 'blob',
    });
    return response.data;
  } catch (error) {
    console.error(`Error downloading document ${id}:`, error);
    throw error;
  }
};

// Website crawl API
// Named export for use as: import { crawlWebsite } from '../services/api';
export const crawlWebsite = async (payload) => {
  // payload: { url: string, crawlSubpages: boolean, maxDepth: number, excludeNavigation: boolean, respectRobotsTxt: boolean }
  try {
    // Normalize the URL if needed
    let url = payload.url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      throw new Error('Invalid URL format');
    }

    // Make the API call with retry logic
    let retries = 3;
    let lastError;

    while (retries > 0) {
      try {
        const response = await api.post('/website/crawl', {
          ...payload,
          url
        });
        return response.data;
      } catch (error) {
        lastError = error;
        if (error.response?.status === 401) {
          // Don't retry auth errors
          throw error;
        }
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retrying
          continue;
        }
      }
    }

    // If we get here, all retries failed
    console.error('Error crawling website after retries:', lastError);
    throw lastError;
  } catch (error) {
    // Add more context to the error
    const enhancedError = new Error(
      error.response?.data?.message || error.message || 'Failed to crawl website'
    );
    enhancedError.originalError = error;
    throw enhancedError;
  }
};

export default api;