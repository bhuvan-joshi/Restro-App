import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import api from '@/services/api';
import { API_BASE_URL } from '@/config/api.config';

const ApiDebugger: React.FC = () => {
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Get the current auth token from localStorage
  React.useEffect(() => {
    const token = localStorage.getItem('auth_token');
    setAuthToken(token);
  }, []);

  const testDocumentsApi = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Testing Documents API...');
      console.log('Current auth token:', localStorage.getItem('auth_token'));
      
      // Make a direct API call to the documents endpoint
      const response = await api.get('/Documents', {
        params: {
          page: 1,
          pageSize: 100,
          excludeContent: false
        }
      });
      
      console.log('API Response:', response);
      setResult(response.data);
    } catch (err: any) {
      console.error('API Error:', err);
      setError(err.message + (err.response ? ` (${err.response.status}: ${JSON.stringify(err.response.data)})` : ''));
    } finally {
      setLoading(false);
    }
  };

  const testDirectApi = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Testing Direct API Call...');
      
      // Get the auth token
      const token = localStorage.getItem('auth_token');
      
      // Make a direct fetch call to the API
      const response = await fetch(`${API_BASE_URL}/Documents?page=1&pageSize=100`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Direct API Response:', data);
      setResult(data);
    } catch (err: any) {
      console.error('Direct API Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const testComprehensiveApi = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      console.log('=== COMPREHENSIVE API TEST ===');
      const testResults: any = { steps: [] };
      
      // Step 1: Check auth token
      const token = localStorage.getItem('auth_token');
      testResults.steps.push({
        name: 'Auth token check',
        status: token ? 'success' : 'warning',
        details: token ? 'Token exists' : 'No auth token found'
      });
      
      if (!token) {
        console.log('No token found. Setting temporary token for testing...');
        const tempToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0VXNlciIsIm5hbWUiOiJUZXN0IFVzZXIiLCJpYXQiOjE2MTYxNjI4OTd9.dR7j2jC_WbLOEq9K0RLvHJ-4Xj9uKvF3eSCfLwqiVkE';
        localStorage.setItem('auth_token', tempToken);
        testResults.steps.push({
          name: 'Temporary token',
          status: 'info',
          details: 'Set temporary token for testing'
        });
      }
      
      // Step 2: Test API server availability with a HEAD request
      try {
        const headResponse = await fetch(`${API_BASE_URL}`, {
          method: 'HEAD'
        });
        testResults.steps.push({
          name: 'API server availability',
          status: headResponse.ok ? 'success' : 'error',
          details: `Status: ${headResponse.status} ${headResponse.statusText}`
        });
      } catch (headError: any) {
        testResults.steps.push({
          name: 'API server availability',
          status: 'error',
          details: `Error: ${headError.message}`
        });
      }
      
      // Step 3: Try Axios approach
      try {
        console.log('Trying Axios API request...');
        const axiosResponse = await api.get('/Documents', {
          params: {
            page: 1,
            pageSize: 100,
            excludeContent: false,
            t: Date.now() // Cache busting
          }
        });
        
        testResults.steps.push({
          name: 'Axios API request',
          status: 'success',
          details: `Status: ${axiosResponse.status}`,
          data: axiosResponse.data
        });
        
        // Set result if successful and we don't already have a result
        if (!testResults.finalResult) {
          testResults.finalResult = axiosResponse.data;
        }
      } catch (axiosError: any) {
        testResults.steps.push({
          name: 'Axios API request',
          status: 'error',
          details: `Error: ${axiosError.message}${
            axiosError.response ? ` (${axiosError.response.status}: ${axiosError.response.statusText})` : ''
          }`
        });
      }
      
      // Step 4: Try Fetch approach
      try {
        console.log('Trying Fetch API request...');
        const refreshedToken = localStorage.getItem('auth_token');
        const fetchResponse = await fetch(`${API_BASE_URL}/Documents?page=1&pageSize=100&t=${Date.now()}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': refreshedToken ? `Bearer ${refreshedToken}` : ''
          }
        });
        
        testResults.steps.push({
          name: 'Fetch API request',
          status: fetchResponse.ok ? 'success' : 'error',
          details: `Status: ${fetchResponse.status} ${fetchResponse.statusText}`
        });
        
        if (fetchResponse.ok) {
          try {
            const fetchData = await fetchResponse.json();
            testResults.steps.push({
              name: 'Fetch API data parsing',
              status: 'success',
              data: fetchData
            });
            
            // Set result if successful and we don't already have a result
            if (!testResults.finalResult) {
              testResults.finalResult = fetchData;
            }
          } catch (parseError: any) {
            testResults.steps.push({
              name: 'Fetch API data parsing',
              status: 'error',
              details: `JSON parse error: ${parseError.message}`
            });
          }
        }
      } catch (fetchError: any) {
        testResults.steps.push({
          name: 'Fetch API request',
          status: 'error',
          details: `Error: ${fetchError.message}`
        });
      }
      
      // Step 5: Try creating a mock document to see if that gets displayed
      try {
        console.log('Creating mock document as fallback...');
        // Create a dummy document for testing display
        const mockDocument = {
          id: 'mock-' + Date.now(),
          name: 'Mock Test Document',
          content: 'This is a mock document created for testing the knowledge base display.',
          uploadDate: new Date().toISOString(),
          tags: ['mock', 'test'],
          confidence: 0.95
        };
        
        testResults.steps.push({
          name: 'Mock document creation',
          status: 'success',
          data: mockDocument
        });
        
        // Set as final result if we don't have one yet
        if (!testResults.finalResult) {
          testResults.finalResult = {
            items: [mockDocument],
            page: 1,
            pageSize: 10,
            totalCount: 1,
            totalPages: 1
          };
        }
      } catch (mockError: any) {
        testResults.steps.push({
          name: 'Mock document creation',
          status: 'error',
          details: `Error: ${mockError.message}`
        });
      }
      
      console.log('Comprehensive test results:', testResults);
      setResult(testResults);
    } catch (err: any) {
      console.error('Comprehensive API Test Error:', err);
      setError('Comprehensive test failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>API Debugger</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Auth Token:</p>
            <div className="bg-muted p-2 rounded-md text-xs overflow-auto max-h-20">
              {authToken || 'No auth token found'}
            </div>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <Button onClick={testDocumentsApi} disabled={loading} variant="outline">
              {loading ? 'Testing...' : 'Test Documents API'}
            </Button>
            <Button onClick={testDirectApi} disabled={loading} variant="outline">
              {loading ? 'Testing...' : 'Test Direct API Call'}
            </Button>
            <Button onClick={testComprehensiveApi} disabled={loading}>
              {loading ? 'Running Tests...' : 'Run Comprehensive API Test'}
            </Button>
          </div>
          
          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
              <p className="font-medium">Error:</p>
              <p className="mt-1">{error}</p>
            </div>
          )}
          
          {result && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-2">API Result:</p>
                <div className="bg-muted p-2 rounded-md text-xs overflow-auto max-h-96">
                  <pre>{JSON.stringify(result, null, 2)}</pre>
                </div>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ApiDebugger;
