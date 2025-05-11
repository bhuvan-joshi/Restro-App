/**
 * API Configuration
 * Centralizes all API endpoints and configuration values
 */

// Base URLs
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5122/api';
export const SIGNALR_URL = import.meta.env.VITE_SIGNALR_URL || 'http://localhost:5122/crawlProgressHub';
export const OLLAMA_URL = import.meta.env.VITE_OLLAMA_URL || 'http://localhost:11434';

// API Endpoints
export const ENDPOINTS = {
  // Document endpoints
  DOCUMENTS: '/Documents',
  DOCUMENT_UPLOAD: '/Documents/upload',
  DOCUMENT_DOWNLOAD: (id: string) => `/Documents/${id}/download`,
  DOCUMENT_BY_ID: (id: string) => `/Documents/${id}`,
  
  // Website crawling
  WEBSITE_CRAWL: '/Website/crawl',
  
  // Widget settings
  WIDGET_SETTINGS: '/WidgetSettings',
  WIDGET_SETTINGS_BY_USER: (userId: string) => `/WidgetSettings/${userId}`,
};

// Configuration object for export
const apiConfig = {
  API_BASE_URL,
  SIGNALR_URL,
  OLLAMA_URL,
  ENDPOINTS
};

export default apiConfig;
