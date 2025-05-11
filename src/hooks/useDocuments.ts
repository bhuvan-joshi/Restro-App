import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { getDocuments, uploadDocument, deleteDocument, downloadDocument } from '../services/api';
import { useToast } from '../hooks/use-toast';
import { API_BASE_URL } from '../config/api.config';

// Define proper TypeScript interfaces
export interface Document {
  id: string;
  name: string;
  originalFileName: string;
  contentType: string;
  size: number;
  uploadDate: string;
  content?: string;
}

export interface DocumentFile {
  file: File | Blob;
  url: string;
  mimeType: string;
}

export type FileType = 'pdf' | 'docx' | 'other';

export interface PaginatedDocumentResponse {
  items: Document[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalCount: number;
}

// Custom hook for document operations
export function useDocuments() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [documentFiles, setDocumentFiles] = useState<Record<string, DocumentFile>>({});
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Custom fetch function that handles pagination with direct fetch approach
  const fetchDocuments = useCallback(async () => {
    try {
      // Log detailed pagination parameters for debugging
      console.log('[useDocuments] Pagination Debug Info:', {
        hookCurrentPage: currentPage,
        hookPageSize: pageSize, 
        hookCurrentPageType: typeof currentPage,
        hookPageSizeType: typeof pageSize
      });
      
      // Ensure we're passing numbers, not strings
      const pageParam = Number(currentPage);
      const sizeParam = Number(pageSize);
      
      console.log(`[useDocuments] Fetching page ${pageParam} with pageSize ${sizeParam}`);
      
      // Add timestamp to prevent caching issues
      const timestamp = Date.now();
      
      // ========== DIRECT FETCH IMPLEMENTATION ==========
      // This bypasses the getDocuments API service function entirely
      // Build URL with explicit query parameters
      const url = `${API_BASE_URL}/Documents?page=${pageParam}&pageSize=${sizeParam}&t=${timestamp}`;
      
      console.log('[useDocuments] Making direct fetch request to:', url);
      
      // Get token for authorization
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      // Execute the fetch request
      const fetchResponse = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'include'
      });
      
      if (!fetchResponse.ok) {
        throw new Error(`API Error: ${fetchResponse.status} ${fetchResponse.statusText}`);
      }
      
      // Parse response data
      const responseData = await fetchResponse.json();
      console.log('[useDocuments] Direct fetch response:', responseData);
      
      // Use the interface to ensure type safety
      const paginatedResponse: PaginatedDocumentResponse = responseData;
      
      // Log pagination values from response
      console.log('[useDocuments] Response pagination values:', {
        responsePage: paginatedResponse.page,
        responsePageSize: paginatedResponse.pageSize,
        responseTotalPages: paginatedResponse.totalPages,
        responseTotalCount: paginatedResponse.totalCount
      });
      
      // Update pagination state
      setTotalPages(paginatedResponse.totalPages || 1);
      setTotalCount(paginatedResponse.totalCount || 0);
      
      return paginatedResponse.items;
    } catch (error) {
      console.error('[useDocuments] Error fetching documents:', error);
      toast({
        title: "Error",
        description: "Failed to load documents. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  }, [currentPage, pageSize, toast]);

  // Fetch documents with React Query
  const {
    data: documents = [],
    isLoading: isLoadingDocuments,
    error: documentsError,
    refetch: refetchDocumentsQuery,
    isFetching: isFetchingDocuments
  } = useQuery<Document[], Error>(
    ['documents', currentPage, pageSize],
    fetchDocuments,
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      keepPreviousData: true, // Keep previous data while fetching new data
      refetchOnWindowFocus: true,
      onError: (error) => console.error('[useDocuments] Query error:', error)
    }
  );
  
  // Refetch documents function that respects pagination
  const refetchDocuments = useCallback(() => {
    return refetchDocumentsQuery();
  }, [refetchDocumentsQuery]);
  
  // Handle page change
  const handlePageChange = useCallback((newPage: number) => {
    if (newPage > 0 && (totalPages === 0 || newPage <= totalPages)) {
      setCurrentPage(newPage);
    }
  }, [totalPages]);

  // Upload document mutation
  const {
    mutate: uploadDocumentMutation,
    isLoading: isUploading,
    error: uploadError,
    reset: resetUploadError
  } = useMutation(
    (file: File) => uploadDocument(file),
    {
      onSuccess: (response, file) => {
        if (response && response.id) {
          // Store the file for viewing
          const mimeType = getMimeType(file.type, file.name);
          const url = URL.createObjectURL(file);
          
          setDocumentFiles(prev => ({
            ...prev,
            [response.id]: {
              file,
              url,
              mimeType
            }
          }));
          
          // Update the documents cache
          queryClient.invalidateQueries(['documents']);
        }
      },
      onError: (error) => console.error('Error uploading document:', error)
    }
  );

  // Delete document mutation
  const {
    mutate: deleteDocumentMutation,
    isLoading: isDeleting,
    error: deleteError,
    reset: resetDeleteError
  } = useMutation(
    (id: string) => deleteDocument(id),
    {
      onSuccess: (_, id) => {
        // Clean up any stored file
        if (documentFiles[id]?.url) {
          URL.revokeObjectURL(documentFiles[id].url);
        }
        
        setDocumentFiles(prev => {
          const newFiles = { ...prev };
          delete newFiles[id];
          return newFiles;
        });
        
        // Update the documents cache
        queryClient.invalidateQueries(['documents']);
      },
      onError: (error) => console.error('Error deleting document:', error)
    }
  );

  // Download document function
  const {
    mutate: downloadDocumentMutation,
    isLoading: isDownloading,
    error: downloadError
  } = useMutation(
    async (id: string) => {
      const blob = await downloadDocument(id);
      return { id, blob };
    },
    {
      onSuccess: ({ id, blob }, docId) => {
        // Find the document to get its details
        const document = documents && Array.isArray(documents) 
          ? documents.find(doc => doc.id === docId) 
          : undefined;
          
        if (!document) {
          console.warn(`[useDocuments] Document with ID ${docId} not found in current documents list`);
          return;
        }
        
        // Determine the correct MIME type
        const mimeType = getMimeType(document.contentType, document.originalFileName);
        
        // Create a new blob with the correct MIME type
        const newBlob = new Blob([blob], { type: mimeType });
        const url = URL.createObjectURL(newBlob);
        
        // Store the file
        setDocumentFiles(prev => ({
          ...prev,
          [id]: {
            file: newBlob,
            url,
            mimeType
          }
        }));
      },
      onError: (error) => {
        console.error('[useDocuments] Error downloading document:', error);
        toast({
          title: "Download Failed",
          description: "Could not download the document. Please try again.",
          variant: "destructive",
        });
      }
    }
  );

  // Helper function to determine file type
  const getFileType = (doc: Document): FileType => {
    const name = doc.originalFileName.toLowerCase();
    const type = doc.contentType.toLowerCase();
    
    if (type.includes('pdf') || name.endsWith('.pdf')) {
      return 'pdf';
    } else if (
      type.includes('word') || 
      type.includes('docx') || 
      type.includes('document') || 
      name.endsWith('.docx') || 
      name.endsWith('.doc')
    ) {
      return 'docx';
    }
    
    return 'other';
  };

  // Helper function to get the correct MIME type
  const getMimeType = (contentType: string, fileName: string): string => {
    const fileExtension = fileName.split('.').pop()?.toLowerCase();
    
    if (contentType && contentType !== 'application/octet-stream') {
      return contentType;
    }
    
    if (fileExtension === 'pdf' || fileName.toLowerCase().includes('.pdf')) {
      return 'application/pdf';
    } else if (
      fileExtension === 'docx' || 
      fileName.toLowerCase().includes('.docx')
    ) {
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (
      fileExtension === 'doc' || 
      fileName.toLowerCase().includes('.doc')
    ) {
      return 'application/msword';
    }
    
    return 'application/octet-stream';
  };

  // Get or download a document file
  const getDocumentFile = async (doc: Document): Promise<DocumentFile | null> => {
    // If we already have the file, return it
    if (documentFiles[doc.id]) {
      return documentFiles[doc.id];
    }
    
    // Otherwise, download it
    try {
      await downloadDocumentMutation(doc.id);
      return documentFiles[doc.id] || null;
    } catch (error) {
      console.error('Error getting document file:', error);
      return null;
    }
  };

  // Clean up function to revoke object URLs
  const cleanup = () => {
    Object.values(documentFiles).forEach(docFile => {
      if (docFile.url) {
        URL.revokeObjectURL(docFile.url);
      }
    });
  };

  return {
    // Data
    documents,
    documentFiles,
    
    // Pagination state
    currentPage,
    pageSize,
    totalPages,
    totalCount,
    
    // Loading states
    isLoadingDocuments,
    isFetchingDocuments,
    isUploading,
    isDeleting,
    isDownloading,
    
    // Error states
    documentsError,
    uploadError,
    deleteError,
    downloadError,
    
    // Reset functions
    resetUploadError,
    resetDeleteError,
    
    // Operations
    uploadDocument: uploadDocumentMutation,
    deleteDocument: deleteDocumentMutation,
    getDocumentFile,
    getFileType,
    refetchDocuments,
    cleanup,
    
    // Pagination controls
    handlePageChange,
    setPageSize
  };
}
