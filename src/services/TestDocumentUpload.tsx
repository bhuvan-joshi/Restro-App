import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import DocumentUpload from '@/components/documents/DocumentUpload';
import { getDocuments } from '@/services/api';

const TestDocumentUpload = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get authentication status
      const token = localStorage.getItem('auth_token');
      console.log('Auth token exists:', !!token);
      if (token) {
        console.log('Token (first 20 chars):', token.substring(0, 20) + '...');
      }
      
      // Load documents
      console.log('Fetching documents...');
      const response = await getDocuments();
      console.log('Documents response:', response);
      
      setDocuments(response);
      toast({
        title: 'Documents loaded',
        description: `Found ${response.length} documents`,
      });
    } catch (err) {
      console.error('Error loading documents:', err);
      
      let errorMessage = 'Failed to load documents';
      if (err.response) {
        errorMessage += ` - Server returned ${err.response.status}: ${err.response.statusText}`;
        console.error('Response data:', err.response.data);
      } else if (err.request) {
        errorMessage += ' - No response from server';
      } else {
        errorMessage += ` - ${err.message}`;
      }
      
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUploadComplete = (files) => {
    console.log('Upload complete for files:', files);
    toast({
      title: 'Upload complete',
      description: `Successfully uploaded ${files.length} file(s)`,
    });
    loadDocuments(); // Reload documents after upload
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Document Upload Test</h1>
      
      <div className="mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Upload Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <DocumentUpload 
              onUploadComplete={handleUploadComplete}
              acceptedFileTypes={['.pdf', '.docx', '.txt', '.csv']}
              maxFileSizeMB={10}
              maxFiles={5}
            />
          </CardContent>
        </Card>
      </div>
      
      <div>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Your Documents</CardTitle>
            <Button onClick={loadDocuments} disabled={loading}>
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 mb-4 rounded">
                <h3 className="font-medium">Error Loading Documents</h3>
                <p>{error}</p>
              </div>
            )}
            
            {documents.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No documents found.</p>
                <p className="text-sm mt-2">
                  Upload documents using the form above to get started.
                </p>
              </div>
            ) : (
              <ul className="divide-y">
                {documents.map((doc) => (
                  <li key={doc.id} className="py-4">
                    <div className="flex items-start">
                      <div className="flex-1">
                        <h3 className="font-medium">{doc.name}</h3>
                        <div className="text-sm text-gray-500">
                          {doc.type} • {doc.size} bytes • Uploaded on {new Date(doc.uploadDate).toLocaleString()}
                        </div>
                        <div className="text-sm mt-1">
                          Status: <span className={doc.status === 'indexed' ? 'text-green-600' : 'text-yellow-600'}>
                            {doc.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            
            <div className="mt-4 text-sm text-gray-600">
              <h3 className="font-medium mb-2">Debug Information:</h3>
              <div className="bg-gray-50 p-3 rounded overflow-auto max-h-40">
                <pre>
                  {JSON.stringify({ 
                    authToken: localStorage.getItem('auth_token') ? 'exists' : 'missing',
                    userId: localStorage.getItem('user_id'),
                    documentCount: documents.length,
                    lastRefreshed: new Date().toISOString()
                  }, null, 2)}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TestDocumentUpload; 