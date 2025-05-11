import React, { useEffect, useState } from 'react';
import { Card, CardContent } from './ui/card';
import { getDocument } from '@/services/api';

interface DocumentPreviewProps {
  documentId: string;
}

const DocumentPreview = ({ documentId }: DocumentPreviewProps) => {
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchContent = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await getDocument(documentId);
        console.log('Document response:', response); // Debug log
        
        // Check if it's a website document
        const isWebsite = response.type?.toLowerCase() === 'website';
        console.log('Is website:', isWebsite); // Debug log
        
        // Always use the content field, but handle null/undefined
        const documentContent = response.content || 'No content available';
        console.log('Document content length:', documentContent.length); // Debug log
        
        setContent(documentContent);
      } catch (error) {
        console.error('Error fetching document content:', error);
        setError('Failed to load document content');
      } finally {
        setIsLoading(false);
      }
    };

    if (documentId) {
      fetchContent();
    }
  }, [documentId]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-4 text-red-500">
          {error}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <pre className="whitespace-pre-wrap font-mono text-sm overflow-auto max-h-[500px]">
          {content}
        </pre>
      </CardContent>
    </Card>
  );
};

export default DocumentPreview; 