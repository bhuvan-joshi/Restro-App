import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Add a simple mock API endpoint for allowed domains
// This simulates what would happen on a real server
if (window.location.pathname === '/api/allowed-domains') {
  const allowedDomains = localStorage.getItem('widget_allowed_domains');
  const domains = allowedDomains ? JSON.parse(allowedDomains) : [];
  
  // Return a JSON response
  const mockResponse = new Response(
    JSON.stringify({ domains }),
    { 
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    }
  );
  
  // Replace the page with the response
  document.open();
  document.write(JSON.stringify({ domains }));
  document.close();
} else {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}
