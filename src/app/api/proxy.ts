import type { NextApiRequest, NextApiResponse } from 'next';

// Proxy API route that forwards requests to the backend
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { path } = req.query;
  
  if (!path || typeof path !== 'string') {
    return res.status(400).json({ error: 'Path parameter is required' });
  }
  
  const targetUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/${path}`;
  
  try {
    console.log(`Proxying ${req.method} request to: ${targetUrl}`);
    
    // Forward the request to the backend
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        // Forward authorization header if present
        ...(req.headers.authorization 
          ? { 'Authorization': req.headers.authorization as string } 
          : {}),
      },
      // Forward the request body for POST/PUT/PATCH requests
      ...(req.method !== 'GET' && req.method !== 'HEAD'
        ? { body: JSON.stringify(req.body) }
        : {}),
    });
    
    // Get the response data
    const contentType = response.headers.get('content-type') || '';
    let data;
    
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }
    
    // Send the response back to the client
    res.status(response.status).json({
      status: response.status,
      statusText: response.statusText,
      data,
      headers: Object.fromEntries(response.headers.entries()),
    });
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Failed to proxy request', details: error.message });
  }
} 