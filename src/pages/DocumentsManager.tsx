import { useState, useEffect, useRef, useCallback } from "react";
import { startSignalRConnection, onCrawlProgressUpdate, stopSignalRConnection } from "@/services/signalrService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Upload, File, Trash, Check, X, Link as LinkIcon, AlertTriangle, Loader2, Download, Database } from "lucide-react";
import DocumentUpload from "@/components/documents/DocumentUpload";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { getDocuments, uploadDocument, deleteDocument, downloadDocument, crawlWebsite, getDocument } from "@/services/api";
import { Switch } from "@/components/ui/switch";
import * as XLSX from 'xlsx';
import { renderAsync } from 'docx-preview';
import { v4 as uuidv4 } from 'uuid';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";

// Define the Document type
export type Document = {
  id: string;
  name: string;
  type: string;
  size: string;
  content: string;
  uploadDate: string;
  status: "uploading" | "processing" | "indexed" | "error" | "pending_indexing" | "failed";
  url?: string;
  errorMessage?: string;
};

export type CrawlProgressUpdate = {
  currentUrl: string;
  discoveredUrlsCount: number;
  processedUrlsCount: number;
  currentAction: string;
  progress: number;
};

// Helper function to extract text from files
const extractTextFromFile = async (file: File): Promise<string> => {
  // In a real app, you would use appropriate libraries for different file types
  // For this example, we'll just handle text and assume others are processed
  
  if (file.type === "text/plain") {
    return await file.text();
  }
  
  // For other file types in a real app, you might use:
  // - pdf.js for PDFs
  // - mammoth.js for Word documents
  // - xlsx.js for Excel files
  
  // Here we'll just return a placeholder for demo purposes
  return `Content extracted from ${file.name} (${file.type})`;
};

// Simple text indexing function (in a real app, you'd use a proper vector DB or search engine)
const processAndIndexDocument = async (doc: Document): Promise<Document> => {
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // In a real app, you would:
  // 1. Extract key terms, entities, etc.
  // 2. Generate embeddings
  // 3. Store in a vector database
  
  return {
    ...doc,
    status: "indexed"
  };
};

// Helper to convert File to Base64 string
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

// Helper to convert Base64 string back to File-like object
const base64ToFile = (base64: string, filename: string, type: string): Blob => {
  const arr = base64.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || type;
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  
  return new Blob([u8arr], { type: mime });
};

// Add this new function to the API calls
const processDocumentEmbeddings = async (all = true, documentIds: string[] = []) => {
  const token = localStorage.getItem('auth_token');
  const { API_BASE_URL } = await import('../config/api.config');
  // API_BASE_URL is imported from config
  
  try {
    const url = `${API_BASE_URL}/api/documents/reprocess${all ? '?all=true' : ''}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: !all && documentIds.length > 0 ? JSON.stringify(documentIds) : undefined
    });
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error processing document embeddings:', error);
    throw error;
  }
};

const DocumentsManager = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [crawlSubpages, setCrawlSubpages] = useState(true);
  const [excludeNav, setExcludeNav] = useState(true);
  const [respectRobots, setRespectRobots] = useState(true);
  const [maxCrawlDepth, setMaxCrawlDepth] = useState(2);
  const [isProcessingUrl, setIsProcessingUrl] = useState(false);
  const [crawlProgress, setCrawlProgress] = useState(0);
  const [crawlStatus, setCrawlStatus] = useState<CrawlProgressUpdate | null>(null);
  const [currentCrawlUrl, setCurrentCrawlUrl] = useState("");
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("documents");
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState("");
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  // Store the original file data for PDF viewing
  const [uploadedFiles, setUploadedFiles] = useState<{[id: string]: File | Blob}>({});
  
  const { toast } = useToast();
  const [isProcessingEmbeddings, setIsProcessingEmbeddings] = useState(false);

  const loadDocuments = async () => {
    try {
      setIsLoading(true);
      const pageParam = parseInt(String(currentPage), 10);
      const sizeParam = parseInt(String(pageSize), 10);
      
      console.log('[DocumentsManager] Loading page', pageParam, 'with size', sizeParam);
      const result = await getDocuments(pageParam, sizeParam);
      
      console.log('[DocumentsManager] Received response:', {
        itemsCount: result.items.length,
        currentPage: result.page,
        totalPages: result.totalPages,
        totalCount: result.totalCount,
        firstItemId: result.items[0]?.id
      });
      
      setDocuments(result.items);
      setTotalPages(result.totalPages);
      setTotalCount(result.totalCount);
      
    } catch (error) {
      console.error("Failed to load documents:", error);
      toast({
        title: "Error loading documents",
        description: "There was a problem loading your documents. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle page change with direct fetch approach
  const handlePageChange = async (newPage: number) => {
    console.log(`[DocumentsManager] Changing to page ${newPage}`);
    
    // Don't allow invalid page numbers
    if (newPage < 1 || (totalPages > 0 && newPage > totalPages)) {
      console.log(`[DocumentsManager] Invalid page number: ${newPage}`);
      return;
    }
    
    try {
      // Set loading state
      setIsLoading(true);
      
      // Update current page first
      setCurrentPage(newPage);
      
      // Add a random query parameter to prevent caching
      const timestamp = Date.now();
      
      // ======= DIRECT FETCH IMPLEMENTATION =======
      // Build URL with explicit query parameters to ensure they're visible in network requests
      const API_BASE_URL = 'http://localhost:5122/api';
      const url = `${API_BASE_URL}/Documents?page=${newPage}&pageSize=${pageSize}&t=${timestamp}`;
      
      console.log(`[DocumentsManager] Making direct fetch request to: ${url}`);
      
      // Set up headers with authentication
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      // Make the direct fetch request
      const fetchResponse = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'include' // Include cookies
      });
      
      if (!fetchResponse.ok) {
        throw new Error(`API Error: ${fetchResponse.status} ${fetchResponse.statusText}`);
      }
      
      // Parse the response
      const response = await fetchResponse.json();
      
      console.log('[DocumentsManager] Direct fetch response:', response);
      console.log('[DocumentsManager] Response type:', typeof response);
      console.log('[DocumentsManager] Response keys:', response ? Object.keys(response) : 'No response');
      
      // Validation
      if (!response) {
        console.error('[DocumentsManager] No response received from API');
        throw new Error('No response received from API');
      }

      // Handle different response formats
      let documentItems = [];
      let totalPagesCount = 1;
      let totalItemsCount = 0;
      
      if (Array.isArray(response)) {
        // Direct array response
        console.log('[DocumentsManager] Response is a direct array');
        documentItems = response;
        totalItemsCount = response.length;
        totalPagesCount = Math.ceil(totalItemsCount / pageSize);
      } else if (response.items && Array.isArray(response.items)) {
        // PaginatedResult format with items property
        console.log('[DocumentsManager] Response has items array property');
        documentItems = response.items;
        totalPagesCount = response.totalPages || Math.ceil(documentItems.length / pageSize);
        totalItemsCount = response.totalCount || documentItems.length;
      } else if (response.data && Array.isArray(response.data)) {
        // Nested data array response
        console.log('[DocumentsManager] Response has data array property');
        documentItems = response.data;
        totalPagesCount = response.totalPages || Math.ceil(documentItems.length / pageSize);
        totalItemsCount = response.totalCount || documentItems.length;
      } else {
        console.error('[DocumentsManager] Invalid response format:', response);
        throw new Error('Response format is not recognized');
      }
      
      // Log the IDs to verify we're getting different records
      const ids = documentItems.map((doc: any) => doc.id?.substring(0, 8) || 'no-id').join(', ');
      console.log(`[DocumentsManager] Loaded page ${newPage} with ${documentItems.length} documents. IDs: ${ids}`);
      
      // Update state with new data
      setDocuments(documentItems);
      setTotalPages(totalPagesCount);
      setTotalCount(totalItemsCount);
      
    } catch (error) {
      console.error('[DocumentsManager] Error changing page:', error);
      console.error('[DocumentsManager] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        error
      });
      toast({
        title: "Error",
        description: "Failed to load documents. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle page size change with immediate data refresh
  const handlePageSizeChange = async (size: number) => {
    // Only change if different
    if (size !== pageSize) {
      console.log(`[DocumentsManager] Changing page size from ${pageSize} to ${size}`);
      
      try {
        // Set loading state
        setIsLoading(true);
        
        // Update page size state
        setPageSize(size);
        
        // Always go back to page 1 when changing page size
        setCurrentPage(1);
        
        // Make direct fetch request with new page size
        const timestamp = Date.now();
        const API_BASE_URL = 'http://localhost:5122/api';
        const url = `${API_BASE_URL}/Documents?page=1&pageSize=${size}&t=${timestamp}`;
        
        console.log(`[DocumentsManager] Making direct fetch with new page size: ${url}`);
        
        // Set up headers with authentication
        const token = localStorage.getItem('auth_token');
        const headers: HeadersInit = {
          'Content-Type': 'application/json'
        };
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        // Make the direct fetch request
        const fetchResponse = await fetch(url, {
          method: 'GET',
          headers,
          credentials: 'include' // Include cookies
        });
        
        if (!fetchResponse.ok) {
          throw new Error(`API Error: ${fetchResponse.status} ${fetchResponse.statusText}`);
        }
        
        // Parse response
        const response = await fetchResponse.json();
        console.log('[DocumentsManager] Page size change response:', response);
        
        // Update documents and pagination data
        let documentItems = [];
        let totalPagesCount = 1;
        let totalItemsCount = 0;
        
        if (Array.isArray(response)) {
          documentItems = response;
          totalItemsCount = response.length;
          totalPagesCount = Math.ceil(totalItemsCount / size);
        } else if (response.items && Array.isArray(response.items)) {
          documentItems = response.items;
          totalPagesCount = response.totalPages || Math.ceil(documentItems.length / size);
          totalItemsCount = response.totalCount || documentItems.length;
        } else if (response.data && Array.isArray(response.data)) {
          documentItems = response.data;
          totalPagesCount = response.totalPages || Math.ceil(documentItems.length / size);
          totalItemsCount = response.totalCount || documentItems.length;
        } else {
          throw new Error('Response format is not recognized');
        }
        
        // Update state with new data
        setDocuments(documentItems);
        setTotalPages(totalPagesCount);
        setTotalCount(totalItemsCount);
        
      } catch (error) {
        console.error('[DocumentsManager] Error changing page size:', error);
        toast({
          title: "Error",
          description: "Failed to update page size. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Initial load
  useEffect(() => {
    // Load first page on mount
    handlePageChange(1);
  }, []);

  // We no longer need to save documents to localStorage as we're using the API
  // This was causing quota exceeded errors with large document collections
  
  // We no longer need to save file metadata to localStorage as we're using the API
  // Files will be downloaded from the API when needed

  const filteredDocuments = documents.filter((doc) =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeleteDocument = async (id: string) => {
    try {
      await deleteDocument(id);
      setDocuments(prev => prev.filter(doc => doc.id !== id));
      
      // Also remove from uploaded files if exists
      if (uploadedFiles[id]) {
        const newUploadedFiles = { ...uploadedFiles };
        delete newUploadedFiles[id];
        setUploadedFiles(newUploadedFiles);
        
        // Update localStorage with just metadata
        const fileMetadata = Object.entries(newUploadedFiles).reduce((acc, [fileId, file]) => {
          acc[fileId] = {
            name: (file as File).name,
            type: (file as File).type
          };
          return acc;
        }, {} as {[id: string]: { name: string; type: string }});
        
        localStorage.setItem("aiWidgetFiles", JSON.stringify(fileMetadata));
      }
      
      toast({
        title: "Document deleted",
        description: "The document has been removed.",
      });
    } catch (error) {
      console.error("Failed to delete document:", error);
      toast({
        title: "Error deleting document",
        description: "There was a problem deleting the document. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleViewDocument = async (doc: Document) => {
    console.log("View document clicked:", doc);
    console.log("Document type:", doc.type);
    console.log("Document ID:", doc.id);
    
    if (doc.type?.toLowerCase() === 'website') {
        try {
            setIsLoading(true);
            const response = await getDocument(doc.id);
            console.log("Website document response:", response);
            
            // If content is empty, try to trigger a re-crawl
            if (!response.content) {
                console.log("No content found, attempting to re-crawl website");
                toast({
                    title: "No content available",
                    description: "The website content is not available. Please try re-adding the website.",
                    variant: "destructive"
                });
            }
            
            // Preserve the original document type and merge with response
            setSelectedDocument({ 
                ...doc,
                ...response,
                type: 'website', // Ensure type is always set for website documents
                content: response.content || 'No content available. Please try re-adding the website.' 
            });
            setIsDetailDialogOpen(true);
        } catch (error) {
            console.error('Error fetching website document content:', error);
            toast({
                title: "Error",
                description: "Failed to fetch website content. Please try again.",
                variant: "destructive"
            });
            setSelectedDocument({ 
                ...doc,
                type: 'website', // Ensure type is set even in error case
                content: 'Error fetching content. Please try re-adding the website.' 
            });
            setIsDetailDialogOpen(true);
        } finally {
            setIsLoading(false);
        }
        return;
    }

    // Rest of the existing code for other document types
    const fileType = getFileType(doc);
    if ((fileType === 'docx' || fileType === 'excel' || fileType === 'pdf') && !uploadedFiles[doc.id]) {
        console.log("Pre-fetching document file for viewing:", doc.name);
        downloadDocumentFile(doc);
    }

    setSelectedDocument(doc);
    setIsDetailDialogOpen(true);
  };

  // Function to create an object URL for viewing the document
  const getDocumentViewUrl = (doc: Document) => {
    console.log("getDocumentViewUrl called for:", doc.name);
    console.log("Document ID:", doc.id);
    const fileOrBlob = uploadedFiles[doc.id];
    console.log("File/Blob found in uploadedFiles?", !!fileOrBlob);
    
    if (fileOrBlob) {
      console.log("Creating Object URL for:", typeof fileOrBlob, fileOrBlob.type || "unknown type");
      return URL.createObjectURL(fileOrBlob);
    }
    
    // If file not found, try to download it based on file type
    const fileType = getFileType(doc);
    console.log("File not found in cache, detected type:", fileType);
    
    if (fileType === 'pdf' || fileType === 'docx' || fileType === 'excel') {
      console.log("Attempting to download document for viewing:", doc.name);
      // We need to return something immediately, so we'll show a loading message
      // The actual download will happen asynchronously
      downloadDocumentFile(doc).then(downloadedBlob => {
        if (downloadedBlob) {
          console.log("Document downloaded successfully, size:", downloadedBlob.size);
          // Force a re-render after download completes
          setIsDetailDialogOpen(false);
          setTimeout(() => setIsDetailDialogOpen(true), 100);
        }
      });
      return null;
    }
    
    console.log("No file found, returning null");
    return null;
  };

  // Function to download a document file when needed
  const downloadDocumentFile = async (doc: Document) => {
    try {
      console.log("Attempting to download document:", doc.name);
      // Set a loading state if needed
      setDocuments(prev => prev.map(d => 
        d.id === doc.id ? { ...d, status: "processing" } : d
      ));
      
      // Download the file
      const blob = await downloadDocument(doc.id);
      console.log("Document downloaded successfully, size:", blob.size, "type:", blob.type);
      
      // For DOCX files, ensure the blob has the correct type
      let finalBlob = blob;
      if (getFileType(doc) === 'docx' && blob.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        console.log("Setting correct MIME type for DOCX file");
        finalBlob = new Blob([await blob.arrayBuffer()], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });
      }
      
      // Store the blob directly in uploadedFiles
      setUploadedFiles(prev => ({
        ...prev,
        [doc.id]: finalBlob
      }));
      
      // Update status back to indexed
      setDocuments(prev => prev.map(d => 
        d.id === doc.id ? { ...d, status: "indexed" } : d
      ));
      
      toast({
        title: "Document ready for viewing",
        description: "The document has been downloaded for viewing.",
      });
      
      return finalBlob;
    } catch (error) {
      console.error("Error downloading document:", error);
      
      // Update status to error
      setDocuments(prev => prev.map(d => 
        d.id === doc.id ? { ...d, status: "error", errorMessage: "Failed to download document" } : d
      ));
      
      toast({
        title: "Error downloading document",
        description: "There was a problem downloading the document. Please try again.",
        variant: "destructive",
      });
      return;
    }
  };

  const handleWebsiteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!websiteUrl.trim()) {
      toast({
        title: "URL Required",
        description: "Please enter a website URL",
        variant: "destructive",
      });
      return;
    }
    
    // Ensure URL has protocol
    let normalizedUrl = websiteUrl;
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    
    try {
      // Parse URL to validate format
      new URL(normalizedUrl);
    } catch (error) {
      toast({
        title: "Invalid URL format",
        description: "Please enter a valid website URL",
        variant: "destructive",
      });
      return;
    }
    
    // Create new document for the website
    const newDocId = uuidv4();
    const domain = new URL(normalizedUrl).hostname;
    const documentName = domain.replace(/^www\./, '');
    
    const newDocument: Document = {
      id: newDocId,
      name: documentName,
      type: "website",
      size: "Calculating...",
      uploadDate: new Date().toISOString(),
      status: "processing",
      url: normalizedUrl,
      content: "",
    };
    
    // Add to documents list and start processing
    setDocuments(prev => [...prev, newDocument]);
    sessionStorage.setItem("pendingWebsiteDocId", newDocId);
    setIsProcessingUrl(true);
    setCrawlProgress(0);
    setCrawlStatus(null);
    
    let signalrConn: any = null;
    let progressInterval: any = null;
    try {
      // Establish SignalR connection for real-time crawl progress
      signalrConn = await startSignalRConnection();
      onCrawlProgressUpdate((progressUpdate: CrawlProgressUpdate) => {
        setCrawlProgress(progressUpdate.progress);
        setCrawlStatus(progressUpdate);
      });
      
      // Fallback: If no progress update for 5 seconds, show simulated progress
      let lastUpdate = Date.now();
      progressInterval = setInterval(() => {
        if (Date.now() - lastUpdate > 5000) {
          setCrawlProgress(prev => {
            const newProgress = prev + Math.random() * 2;
            return newProgress >= 95 ? 95 : newProgress;
          });
        }
      }, 1000);
      
      // Call the real crawlWebsite API
      console.log("Calling website crawl API with:", {
        url: normalizedUrl,
        crawlSubpages,
        maxDepth: maxCrawlDepth,
        excludeNavigation: excludeNav,
        respectRobotsTxt: respectRobots
      });
      
      setCurrentCrawlUrl(normalizedUrl);
      const response = await crawlWebsite({
        url: normalizedUrl,
        crawlSubpages,
        maxDepth: maxCrawlDepth,
        excludeNavigation: excludeNav,
        respectRobotsTxt: respectRobots
      });
      
      clearInterval(progressInterval);
      setCrawlProgress(100);
      // Optionally set crawlStatus to final state if needed
      
      // Extract content, discovered URLs, and document ID from the response
      const content = response.content || "";
      const discoveredUrls = response.discoveredUrls || [];
      const documentId = response.documentId;
      
      setPreviewContent(content || "No content found");
      setPreviewUrls(discoveredUrls);
      setIsProcessingUrl(false);
      setIsPreviewDialogOpen(true);
      sessionStorage.setItem("crawledContent", content);
      sessionStorage.setItem("crawledUrls", JSON.stringify(discoveredUrls));
      sessionStorage.setItem("crawledDocumentId", documentId);
      
      // Clean up SignalR connection
      await stopSignalRConnection();
    } catch (error) {
      if (progressInterval) clearInterval(progressInterval);
      if (signalrConn) await stopSignalRConnection();
      const errorMessage = error instanceof Error ? error.message : "Failed to crawl website";
      setDocuments(prev => 
        prev.map(doc => 
          doc.id === newDocId 
            ? { ...doc, status: "failed", errorMessage } 
            : doc
        )
      );
      toast({
        title: "Website crawling failed",
        description: errorMessage,
        variant: "destructive"
      });
      setIsProcessingUrl(false);
      setCrawlProgress(0);
      setCrawlStatus(null);
      sessionStorage.removeItem("pendingWebsiteDocId");
    }
  };


  // Called when user confirms indexing after preview
  const handleConfirmIndexing = () => {
    // Close the preview dialog
    setIsPreviewDialogOpen(false);
    
    // Get the stored data from session storage
    const pendingDocId = sessionStorage.getItem("pendingWebsiteDocId");
    const content = sessionStorage.getItem("crawledContent");
    const documentId = sessionStorage.getItem("crawledDocumentId");
    const discoveredUrls = JSON.parse(sessionStorage.getItem("crawledUrls") || "[]");
    
    if (!pendingDocId || !content || !documentId) {
      console.error("Missing required data for indexing", {
        pendingDocId,
        contentExists: !!content,
        documentId
      });
      return;
    }
    
    // Update the document with the real document ID from the backend
    setDocuments(prev => 
      prev.map(doc => 
        doc.id === pendingDocId
          ? { 
              ...doc,
              id: documentId,
              type: "website", // Ensure type is set for website documents
              status: "indexed",
              content: content,
              size: `${Math.round(content.length / 1024)} KB`
            } 
          : doc
      )
    );
    
    // Cleanup session storage
    sessionStorage.removeItem("pendingWebsiteDocId");
    sessionStorage.removeItem("crawledContent");
    sessionStorage.removeItem("crawledUrls");
    sessionStorage.removeItem("crawledDocumentId");
    
    // Reset UI state
    setPreviewContent("");
    setPreviewUrls([]);
    setIsProcessingUrl(false);
    setCrawlProgress(0);
    setCrawlStatus(null);
    setCurrentCrawlUrl("");
    setWebsiteUrl("");
    
    // Show success message
    toast({
      title: "Website indexed successfully",
      description: `Content from ${discoveredUrls.length} page(s) has been added to your documents`,
      variant: "default"
    });
  };
  
  // Called when user cancels indexing after preview
  const handleCancelIndexing = () => {
    try {
      // Get the pending document ID
      const pendingDocId = sessionStorage.getItem("pendingWebsiteDocId");
      if (pendingDocId) {
        // Remove the pending document
        setDocuments(prev => prev.filter(doc => doc.id !== pendingDocId));
      }
    } finally {
      // Close the preview dialog and clean up
      setIsPreviewDialogOpen(false);
      sessionStorage.removeItem("pendingWebsiteDocId");
      setIsProcessingUrl(false);
      setWebsiteUrl("");
    }
  };

  const handleUploadComplete = async (files: File[]) => {
    try {
      console.log("Upload complete handler received files:", files.map(f => f.name));
      toast({
        title: "Upload complete",
        description: `Successfully uploaded ${files.length} document(s).`,
      });
      
      // Set loading state
      const loadingDocs = files.map(file => ({
        id: `temp-${Date.now()}-${file.name}`,
        name: file.name,
        type: file.type.split('/').pop() || 'unknown',
        size: `${Math.round(file.size / 1024)} KB`,
        content: "",
        uploadDate: new Date().toISOString().split('T')[0],
        status: "processing" as const,
      }));
      
      // Add temporary loading documents
      setDocuments(prev => [...loadingDocs, ...prev]);
      
      // Switch to documents tab immediately
      setActiveTab("documents");
      
      // Reload documents from API to get the latest
      try {
        // Just reload documents using the same function
        await handlePageChange(currentPage);
        
        // Store uploaded files in memory for viewing PDFs
        const newUploadedFiles = { ...uploadedFiles };
        
        // Match documents with uploaded files by filename
        for (const file of files) {
          const matchingDoc = documents.find(doc => 
            doc.name.toLowerCase() === file.name.toLowerCase() || 
            doc.name.includes(file.name)
          );
          
          if (matchingDoc) {
            newUploadedFiles[matchingDoc.id] = file;
          }
        }
        
        setUploadedFiles(newUploadedFiles);
      } catch (error) {
        console.error("Failed to reload documents after upload:", error);
        toast({
          title: "Error refreshing documents",
          description: "Documents were uploaded but we couldn't refresh the list. Please reload the page.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to complete upload:", error);
      toast({
        title: "Upload failed",
        description: "There was a problem uploading your documents. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Function to determine file type
  const getFileType = (doc: Document): 'pdf' | 'docx' | 'excel' | 'other' => {
    const name = doc.name.toLowerCase();
    const type = doc.type?.toLowerCase() || '';
    
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
    } else if (
      type.includes('excel') || 
      type.includes('spreadsheet') || 
      type.includes('sheet') ||
      type.includes('csv') ||
      name.endsWith('.xlsx') || 
      name.endsWith('.xls') || 
      name.endsWith('.csv')
    ) {
      return 'excel';
    }
    
    return 'other';
  };

  // Reference to the document viewer container
  const docViewerRef = useRef<HTMLDivElement>(null);
  
  // Function to render DOCX document
  const renderDocxDocument = async (file: File | Blob) => {
    if (!docViewerRef.current) return;
    
    try {
      console.log("Rendering DOCX document:", file);
      console.log("File type:", file.type);
      console.log("File size:", typeof file.size !== 'undefined' ? file.size : "unknown");
      
      // Clear any previous content
      docViewerRef.current.innerHTML = '';
      
      // Create a container for the document
      const container = document.createElement('div');
      container.className = 'docx-container h-full w-full';
      docViewerRef.current.appendChild(container);
      
      // Create a loading indicator that we'll remove when rendering completes
      const loadingIndicator = document.createElement('div');
      loadingIndicator.className = 'flex items-center justify-center h-40';
      loadingIndicator.innerHTML = `
        <div class="flex flex-col items-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
          <p class="text-sm text-gray-600">Rendering document...</p>
        </div>
      `;
      container.appendChild(loadingIndicator);
      
      // DOCX rendering options
      const options = {
        className: 'docx-viewer',
        inWrapper: true,
        ignoreWidth: true,
        ignoreHeight: false,
        defaultFont: {
          family: 'Arial',
          size: 12,
        },
        debug: true // Enable debug mode for more detailed logs
      };
      
      // Log that we're about to call renderAsync
      console.log("Calling renderAsync with docx-preview...");
      
      // Render the DOCX file using docx-preview
      await renderAsync(file, container, null, options);
      
      // Remove the loading indicator
      if (loadingIndicator && loadingIndicator.parentNode) {
        loadingIndicator.parentNode.removeChild(loadingIndicator);
      }
      
      console.log("DOCX rendering completed successfully");
    } catch (error) {
      console.error("Error rendering DOCX:", error);
      
      if (docViewerRef.current) {
        docViewerRef.current.innerHTML = `
          <div class="p-4 bg-red-50 text-red-800 rounded">
            <h3 class="font-bold mb-2">Failed to render DOCX file</h3>
            <p class="mb-2">Error details: ${error instanceof Error ? error.message : 'Unknown error'}</p>
            <p>Please download the file to view it in your preferred document viewer.</p>
          </div>
        `;
      }
      
      // Show toast notification
      toast({
        title: "Document viewer error",
        description: "There was a problem rendering the DOCX file. You can download the file instead.",
        variant: "destructive",
      });
    }
  };
  
  // Function to render Excel document
  const renderExcelDocument = async (file: File | Blob) => {
    if (!docViewerRef.current) return;
    
    try {
      // Clear the container first
      docViewerRef.current.innerHTML = '';
      
      // Create a container for the Excel sheet
      const container = document.createElement('div');
      container.className = 'excel-container overflow-auto max-h-[500px]';
      docViewerRef.current.appendChild(container);
      
      // Read the Excel file
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      
      // Get the first sheet
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Convert to HTML
      const html = XLSX.utils.sheet_to_html(worksheet);
      
      // Add styles for better appearance
      const styledHtml = `
        <div class="p-4">
          <h3 class="text-lg font-medium mb-4">Sheet: ${firstSheetName}</h3>
          <div class="overflow-x-auto">
            <style>
              table { border-collapse: collapse; width: 100%; }
              th, td { border: 1px solid #ddd; padding: 8px; }
              tr:nth-child(even) { background-color: #f2f2f2; }
              th { padding-top: 12px; padding-bottom: 12px; text-align: left; background-color: #f8f9fa; }
            </style>
            ${html}
          </div>
        </div>
      `;
      
      // Insert the HTML
      container.innerHTML = styledHtml;
      
      // Create tabs if there are multiple sheets
      if (workbook.SheetNames.length > 1) {
        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'excel-tabs flex border-b mb-4';
        
        // Insert tabs before the Excel container
        docViewerRef.current.insertBefore(tabsContainer, container);
        
        // Create tabs for each sheet
        workbook.SheetNames.forEach((sheetName, index) => {
          const tab = document.createElement('button');
          tab.className = `px-4 py-2 ${index === 0 ? 'border-b-2 border-blue-600' : ''}`;
          tab.textContent = sheetName;
          tab.onclick = () => {
            // Remove active class from all tabs
            tabsContainer.querySelectorAll('button').forEach(btn => {
              btn.className = 'px-4 py-2';
            });
            // Add active class to clicked tab
            tab.className = 'px-4 py-2 border-b-2 border-blue-600';
            
            // Update content
            const sheet = workbook.Sheets[sheetName];
            const sheetHtml = XLSX.utils.sheet_to_html(sheet);
            container.innerHTML = `
              <div class="p-4">
                <h3 class="text-lg font-medium mb-4">Sheet: ${sheetName}</h3>
                <div class="overflow-x-auto">
                  <style>
                    table { border-collapse: collapse; width: 100%; }
                    th, td { border: 1px solid #ddd; padding: 8px; }
                    tr:nth-child(even) { background-color: #f2f2f2; }
                    th { padding-top: 12px; padding-bottom: 12px; text-align: left; background-color: #f8f9fa; }
                  </style>
                  ${sheetHtml}
                </div>
              </div>
            `;
          };
          tabsContainer.appendChild(tab);
        });
      }
    } catch (error) {
      console.error("Error rendering Excel:", error);
      if (docViewerRef.current) {
        docViewerRef.current.innerHTML = '<div class="p-4 bg-red-50 text-red-800 rounded">Failed to render Excel file. Please download the file to view it.</div>';
      }
    }
  };

  // Use effect to render document when selected document changes
  useEffect(() => {
    // Skip if no document is selected
    if (!selectedDocument) return;
    
    const fileType = getFileType(selectedDocument);
    console.log("Document rendering useEffect triggered - fileType:", fileType);
    
    // Skip rendering for non-document types or PDF (handled by iframe)
    if (fileType !== 'docx' && fileType !== 'excel') {
      console.log("Skipping rendering for type:", fileType);
      return;
    }
    
    // Ensure we have a reference to the container
    if (!docViewerRef.current) {
      console.log("No docViewerRef.current available, cannot render");
      return;
    }
    
    // Set initial loading state if not already set
    if (!docViewerRef.current.querySelector('.loading-indicator')) {
      docViewerRef.current.innerHTML = `
        <div class="loading-indicator flex flex-col items-center justify-center h-full">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600 mb-1">Preparing document...</p>
          <p className="text-xs text-gray-500">This may take a few moments</p>
        </div>
      `;
    }
    
    // Check if we have the file in uploadedFiles
    const file = uploadedFiles[selectedDocument.id];
    if (!file) {
      console.log("File not found in uploadedFiles, attempting to download...");
      
      // Try to download the file first
      downloadDocumentFile(selectedDocument)
        .then(downloadedBlob => {
          if (!downloadedBlob) {
            console.log("Download failed or returned null");
            return;
          }
          
          console.log("File downloaded successfully, size:", downloadedBlob.size, "type:", downloadedBlob.type);
          
          // Re-check if we still have the container (could have been unmounted)
          if (!docViewerRef.current) return;
          
          console.log("Rendering downloaded document...");
          if (fileType === 'docx') {
            renderDocxDocument(downloadedBlob);
          } else if (fileType === 'excel') {
            renderExcelDocument(downloadedBlob);
          }
        })
        .catch(error => {
          console.error("Error downloading document for rendering:", error);
          if (docViewerRef.current) {
            docViewerRef.current.innerHTML = `
              <div class="p-6 bg-red-50 text-red-800 rounded flex flex-col items-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 class="text-lg font-bold mb-2">Failed to download document</h3>
                <p class="text-center mb-4">Please try again or download the file manually.</p>
                <button 
                  class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  onclick="window.location.reload()"
                >
                  Try Again
                </button>
              </div>
            `;
          }
        });
      return;
    }
    
    // We have the file, render it
    console.log("File found in uploadedFiles, rendering directly...", file.type, "size:", 
      typeof file.size !== 'undefined' ? file.size : "unknown");
    try {
      if (fileType === 'docx') {
        renderDocxDocument(file);
      } else if (fileType === 'excel') {
        renderExcelDocument(file);
      }
    } catch (err) {
      console.error("Error initiating document rendering:", err);
      // Provide download fallback UI
      if (docViewerRef.current) {
        const downloadUrl = URL.createObjectURL(file);
        docViewerRef.current.innerHTML = `
          <div class="p-6 bg-yellow-50 text-yellow-800 rounded flex flex-col items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-yellow-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 class="text-lg font-bold mb-2">Document Viewer Unavailable</h3>
            <p class="text-center mb-4">We couldn't render the document in the browser. Please download it to view.</p>
            <a 
              href="${downloadUrl}" 
              download="${selectedDocument.name}"
              class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
            >
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download ${fileType.toUpperCase()} File
            </a>
          </div>
        `;
      }
    }
  }, [selectedDocument, uploadedFiles]);

  // Add pagination UI render function
  const renderPagination = () => {
    // Always show pagination UI regardless of page count
    // If no pages, show at least 1 page
    const displayTotalPages = Math.max(totalPages || 1, 1);
    
    return (
      <div className="mt-4">
        <div className="flex justify-between items-center mb-2">
          <div className="text-sm text-gray-500">
            Showing {documents.length} of {totalCount} documents
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm">Page Size:</span>
            <select 
              value={pageSize} 
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
        
        <div className="flex justify-center mt-2">
          <div className="flex space-x-1">
            {/* Previous button */}
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className={`px-2 py-1 rounded border ${
                currentPage === 1 ? 'bg-gray-100 text-gray-400' : 'bg-white hover:bg-gray-50'
              }`}
            >
              Previous
            </button>
            
            {/* Page numbers - always show at least one page */}
            {Array.from({ length: displayTotalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`px-3 py-1 rounded ${
                  currentPage === page
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 border hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            ))}
            
            {/* Next button */}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= displayTotalPages}
              className={`px-2 py-1 rounded border ${
                currentPage >= displayTotalPages ? 'bg-gray-100 text-gray-400' : 'bg-white hover:bg-gray-50'
              }`}
            >
              Next
            </button>
          </div>
        </div>
        
        {/* Pagination debug info removed */}
      </div>
    );
  };

  // Handle processing document embeddings
  const handleProcessEmbeddings = async () => {
    try {
      setIsProcessingEmbeddings(true);
      const result = await processDocumentEmbeddings(true);
      toast({
        title: "Embeddings processed",
        description: `Successfully processed ${result.processedCount || 0} documents.`,
      });
    } catch (error) {
      console.error("Failed to process embeddings:", error);
      toast({
        title: "Error processing embeddings",
        description: "There was a problem processing document embeddings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessingEmbeddings(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Document Manager</h1>
        <p className="text-gray-600">Upload and manage documents for your AI to learn from</p>
        
        <div className="flex space-x-2 mt-4">
          <Button
            onClick={handleProcessEmbeddings}
            disabled={isProcessingEmbeddings}
            variant="outline"
          >
            {isProcessingEmbeddings ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Database className="mr-2 h-4 w-4" />
                Process Embeddings
              </>
            )}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="documents" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="documents">Uploaded Documents</TabsTrigger>
          <TabsTrigger value="upload">Upload Documents</TabsTrigger>
          <TabsTrigger value="website">Add Website</TabsTrigger>
        </TabsList>
        
        <TabsContent value="documents">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Your Documents</CardTitle>
              <CardDescription>
                These documents are being used to train your AI assistant.
              </CardDescription>
              
              <div className="flex items-center mt-2">
                <Search className="w-4 h-4 text-gray-500 mr-2" />
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-sm"
                />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  <span className="ml-2 text-gray-500">Loading documents...</span>
                </div>
              ) : filteredDocuments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No documents found.</p>
                  <p className="text-sm mt-2">
                    Upload documents or add a website URL to get started.
                  </p>
                </div>
              ) : (
                <>
                  <div className="rounded-md border">
                    <div className="grid grid-cols-12 p-3 bg-gray-50 text-sm font-medium text-gray-600">
                      <div className="col-span-5">Name</div>
                      <div className="col-span-2">Type</div>
                      <div className="col-span-1">Size</div>
                      <div className="col-span-2">Status</div>
                      <div className="col-span-2">Actions</div>
                    </div>
                    
                    <div className="divide-y">
                      {filteredDocuments.map((doc) => (
                        <div key={doc.id} className="grid grid-cols-12 p-3 items-center text-sm">
                          <div className="col-span-5 flex items-center">
                            <File className="w-4 h-4 text-gray-500 mr-2" />
                            <span className="truncate">{doc.name}</span>
                          </div>
                          <div className="col-span-2 uppercase text-xs">{doc.type || getFileType(doc)}</div>
                          <div className="col-span-1">{doc.size}</div>
                          <div className="col-span-2">
                            {doc.status === "indexed" ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <Check className="w-3 h-3 mr-1" /> Indexed
                              </span>
                            ) : doc.status === "processing" ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Processing
                              </span>
                            ) : doc.status === "error" ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                <AlertTriangle className="w-3 h-3 mr-1" /> Error
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                Uploading
                              </span>
                            )}
                          </div>
                          <div className="col-span-2 flex space-x-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewDocument(doc)}
                              className="text-gray-500 hover:text-blue-500"
                            >
                              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M7.5 11.25C9.5711 11.25 11.25 9.5711 11.25 7.5C11.25 5.4289 9.5711 3.75 7.5 3.75C5.4289 3.75 3.75 5.4289 3.75 7.5C3.75 9.5711 5.4289 11.25 7.5 11.25Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M14.1019 8.3794C14.1671 7.9394 14.1937 7.4934 14.1811 7.0474C14.1684 6.6014 14.1163 6.1554 14.0246 5.7194C13.7123 4.1394 12.9135 2.6994 11.7451 1.6174C10.5766 0.535397 9.0838 -0.0486031 7.5 0.00339691C5.9162 -0.0486031 4.4234 0.535397 3.255 1.6174C2.0865 2.6994 1.2877 4.1394 0.975384 5.7194C0.883725 6.1554 0.831606 6.6014 0.818947 7.0474C0.806288 7.4934 0.832909 7.9394 0.898072 8.3794" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="text-gray-500 hover:text-red-500"
                            >
                              <Trash className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Pagination Controls */}
                  {renderPagination()}
                </>
              )}

              {documents.some(doc => doc.status === "processing") && (
                <Alert className="mt-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertTitle>Processing documents</AlertTitle>
                  <AlertDescription>
                    Some documents are still being processed. This may take a few minutes depending on the size and number of documents.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle>Upload Documents</CardTitle>
              <CardDescription>
                Upload documents like PDFs, Word files, spreadsheets, or text files for your AI to learn from.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentUpload onUploadComplete={handleUploadComplete} />
              
              {/* Add our Process Embeddings button here */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h3 className="text-sm font-medium mb-2">Document Processing</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Process document embeddings to improve search and AI responses.
                </p>
                <Button
                  onClick={handleProcessEmbeddings}
                  disabled={isProcessingEmbeddings}
                  variant="outline"
                >
                  {isProcessingEmbeddings ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Database className="mr-2 h-4 w-4" />
                      Process Document Embeddings
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="website">
          <Card>
            <CardHeader>
              <CardTitle>Add Website</CardTitle>
              <CardDescription>
                Enter a website URL to crawl and index content from that site.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleWebsiteSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="websiteUrl">Website URL</Label>
                  <div className="flex items-center space-x-2">
                    <div className="relative flex-1">
                      <LinkIcon className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
                      <Input
                        id="websiteUrl"
                        value={websiteUrl}
                        onChange={(e) => setWebsiteUrl(e.target.value)}
                        placeholder="https://example.com"
                        className="pl-10"
                        disabled={isProcessingUrl}
                      />
                    </div>
                    <Button type="submit" disabled={isProcessingUrl}>
                      {isProcessingUrl ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        "Add Website"
                      )}
                    </Button>
                  </div>
                </div>
                
                {isProcessingUrl && (
                  <div className="space-y-2 mt-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Crawling progress</span>
                      <span>{crawlProgress.toFixed(2)}%</span>
                    </div>
                    <Progress value={crawlProgress} className="h-2" />
                    {crawlStatus && (
                      <div className="mt-3 space-y-3">
                        {/* Current URL being crawled - more prominent display */}
                        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                          <p className="text-sm font-medium text-blue-800 mb-1">Currently crawling:</p>
                          <div className="flex items-center">
                            <LinkIcon className="h-4 w-4 text-blue-500 mr-2 flex-shrink-0" />
                            <p className="text-sm text-blue-700 break-all">{crawlStatus.currentUrl}</p>
                          </div>
                        </div>
                        
                        {/* Other status information */}
                        <div className="space-y-1 text-sm text-gray-600">
                          <p><strong>Current action:</strong> {crawlStatus.currentAction}</p>
                          <p><strong>Pages discovered:</strong> {crawlStatus.discoveredUrlsCount}</p>
                          <p><strong>Pages processed:</strong> {crawlStatus.processedUrlsCount}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="bg-gray-50 p-4 rounded-md">
                  <h4 className="font-medium mb-2">Website Crawling Options</h4>
                  <div className="space-y-4">
                    <div className="flex items-start space-x-2">
                      <input
                        type="checkbox"
                        id="crawl-subpages"
                        className="mt-1"
                        checked={crawlSubpages}
                        onChange={(e) => setCrawlSubpages(e.target.checked)}
                        disabled={isProcessingUrl}
                        title="Enable crawling of subpages"
                        aria-label="Crawl subpages"
                      />
                      <div>
                        <Label htmlFor="crawl-subpages">Crawl subpages</Label>
                        <p className="text-xs text-gray-500">
                          Also index content from pages linked from the homepage.
                        </p>
                      </div>
                    </div>
                    
                    {crawlSubpages && (
                      <div className="ml-6 space-y-2">
                        <Label htmlFor="max-depth">Maximum crawl depth</Label>
                        <div className="flex items-center">
                          <input
                            type="range"
                            id="max-depth"
                            min="1"
                            max="5"
                            value={maxCrawlDepth}
                            onChange={(e) => setMaxCrawlDepth(parseInt(e.target.value))}
                            className="flex-1 mr-2"
                            disabled={isProcessingUrl}
                            title="Adjust maximum crawl depth"
                            aria-label="Maximum crawl depth"
                          />
                          <span className="text-sm font-medium w-5">{maxCrawlDepth}</span>
                        </div>
                        <p className="text-xs text-gray-500">
                          How many levels of links to follow (higher values will take longer).
                        </p>
                      </div>
                    )}
                    
                    <div className="flex items-start space-x-2">
                      <input
                        type="checkbox"
                        id="exclude-nav"
                        className="mt-1"
                        checked={excludeNav}
                        onChange={(e) => setExcludeNav(e.target.checked)}
                        disabled={isProcessingUrl}
                        title="Exclude navigation elements"
                        aria-label="Exclude navigation and footers"
                      />
                      <div>
                        <Label htmlFor="exclude-nav">Exclude navigation and footers</Label>
                        <p className="text-xs text-gray-500">
                          Don't index content from navigation menus, footers, and other common elements.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-2">
                      <input
                        type="checkbox"
                        id="respect-robots"
                        className="mt-1"
                        checked={respectRobots}
                        onChange={(e) => setRespectRobots(e.target.checked)}
                        disabled={isProcessingUrl}
                        title="Respect robots.txt rules"
                        aria-label="Respect robots.txt"
                      />
                      <div>
                        <Label htmlFor="respect-robots">Respect robots.txt</Label>
                        <p className="text-xs text-gray-500">
                          Follow the site's robots.txt rules for crawling.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Document Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedDocument?.name}</DialogTitle>
            <DialogDescription>
              {selectedDocument?.type.toUpperCase()} • {selectedDocument?.size} • Uploaded on {selectedDocument?.uploadDate}
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-[60vh] overflow-y-auto border rounded-md p-4 bg-gray-50">
            {selectedDocument?.status === "error" ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Processing Error</AlertTitle>
                <AlertDescription>
                  {selectedDocument.errorMessage || "An error occurred while processing this document."}
                </AlertDescription>
              </Alert>
            ) : selectedDocument?.status === "processing" ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-4" />
                <p className="text-gray-600">Processing document...</p>
              </div>
            ) : (() => {
                // Enhanced file type detection with detailed logging
                const documentName = selectedDocument?.name || '';
                const documentType = selectedDocument?.type || '';
                
                const fileType = selectedDocument ? getFileType(selectedDocument) : 'other';
                const hasFile = selectedDocument && uploadedFiles[selectedDocument.id];
                
                console.log("Document view condition check:", {
                  documentName,
                  documentType,
                  fileType,
                  documentId: selectedDocument?.id,
                  hasFileInUploadedFiles: hasFile,
                  uploadedFilesKeys: Object.keys(uploadedFiles)
                });
                
                if (fileType === 'pdf' && hasFile) {
                  return (
                    <div className="flex flex-col">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-medium">PDF Viewer</h3>
                        <a 
                          href={getDocumentViewUrl(selectedDocument) || "#"} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center text-blue-600 hover:text-blue-800"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          Open in new tab
                        </a>
                      </div>
                      
                      {/* Direct link for more reliable PDF viewing */}
                      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                        <p className="text-sm text-blue-800 mb-2">
                          If the PDF doesn't load in the viewer below, please use this direct link:
                        </p>
                        <a 
                          href={getDocumentViewUrl(selectedDocument) || "#"} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          View PDF Directly
                        </a>
                      </div>
                      
                      {/* Try to render in iframe first */}
                      <iframe 
                        src={getDocumentViewUrl(selectedDocument) || ""} 
                        className="w-full h-[500px] border rounded"
                        title={selectedDocument.name}
                      />
                    </div>
                  );
                } else if (fileType === 'docx' && hasFile) {
                  return (
                    <div className="flex flex-col">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-medium">Word Document Viewer</h3>
                        <div className="flex items-center space-x-2">
                          <a 
                            href={getDocumentViewUrl(selectedDocument) || "#"} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            download={selectedDocument.name}
                            className="flex items-center text-blue-600 hover:text-blue-800"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </a>
                          <span className="text-xs text-gray-500 border-l pl-2 border-gray-300">
                            {selectedDocument.size}
                          </span>
                        </div>
                      </div>
                      
                      {/* Information message */}
                      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                        <p className="text-sm text-blue-800">
                          <svg className="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          The document is being rendered in the browser. If it doesn't display correctly, you can download it to view in Microsoft Word or other document viewers.
                        </p>
                      </div>
                      
                      {/* DOCX Document viewer container */}
                      <div 
                        ref={docViewerRef} 
                        className="w-full min-h-[500px] border rounded bg-white p-4 overflow-auto"
                      >
                        <div className="flex items-center justify-center h-full">
                          <div className="flex flex-col items-center">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
                            <p className="text-gray-600 mb-1">Loading document...</p>
                            <p className="text-xs text-gray-500">This may take a few moments</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                } else if (fileType === 'excel' && hasFile) {
                  return (
                    <div className="flex flex-col">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-medium">Excel Viewer</h3>
                        <div className="flex items-center space-x-2">
                          <a 
                            href={getDocumentViewUrl(selectedDocument) || "#"} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            download={selectedDocument.name}
                            className="flex items-center text-blue-600 hover:text-blue-800"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </a>
                          <span className="text-xs text-gray-500 border-l pl-2 border-gray-300">
                            {selectedDocument.size}
                          </span>
                        </div>
                      </div>
                      
                      {/* Information message */}
                      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                        <p className="text-sm text-blue-800">
                          <svg className="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          The spreadsheet is being rendered in the browser. If it doesn't display correctly, you can download it to view in Microsoft Excel or other spreadsheet applications.
                        </p>
                      </div>
                      
                      {/* Excel viewer container */}
                      <div 
                        ref={docViewerRef} 
                        className="w-full min-h-[500px] border rounded bg-white p-4 overflow-auto"
                      >
                        <div className="flex items-center justify-center h-full">
                          <div className="flex flex-col items-center">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
                            <p className="text-gray-600 mb-1">Loading spreadsheet...</p>
                            <p className="text-xs text-gray-500">This may take a few moments</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                } else if (selectedDocument?.type?.toLowerCase() === 'website') {
                  return (
                    <div className="flex flex-col">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-medium">Website Content</h3>
                        <a 
                          href={selectedDocument.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center text-blue-600 hover:text-blue-800"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          Visit Website
                        </a>
                      </div>
                      
                      <div className="whitespace-pre-wrap font-mono text-sm bg-white p-4 rounded border">
                        {selectedDocument.content || "No content available"}
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <h3 className="text-sm font-medium mb-2">Website Information</h3>
                        <p className="text-xs text-gray-600">
                          This website has been crawled and indexed for your AI assistant to use when answering questions.
                        </p>
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div className="whitespace-pre-wrap font-mono text-sm">
                      {selectedDocument?.content || "No content available"}
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <h3 className="text-sm font-medium mb-2">Document Information</h3>
                        <p className="text-xs text-gray-600">
                      dsfsfsa    This document has been processed and indexed for your AI assistant to use when answering questions.
                        </p>
                      </div>
                    </div>
                  );
                }
              })()
          }
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>
              Close
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                if (selectedDocument) {
                  handleDeleteDocument(selectedDocument.id);
                  setIsDetailDialogOpen(false);
                }
              }}
            >
              <Trash className="h-4 w-4 mr-2" />
              Delete Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Website Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={(open) => {
        if (!open) handleCancelIndexing();
        setIsPreviewDialogOpen(open);
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Website Content Preview</DialogTitle>
            <DialogDescription>
              Review the content extracted from the website before adding it to your knowledge base.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Discovered URLs section */}
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-medium">Discovered Pages ({previewUrls.length})</h3>
              <span className="text-xs text-gray-500">
                {crawlSubpages ? `Crawl depth: ${maxCrawlDepth}` : "Homepage only"}
              </span>
            </div>
            
            <div className="bg-gray-100 rounded p-2 mb-4 max-h-32 overflow-y-auto">
              {previewUrls.length === 0 ? (
                <p className="text-gray-500 text-sm">No additional pages discovered.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                  {previewUrls.map((url, i) => (
                    <div key={i} className="text-xs text-gray-700 truncate">
                      <span className="inline-block w-4 h-4 bg-blue-100 text-blue-800 rounded text-center mr-1">{i+1}</span>
                      {url}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Extracted content section */}
            <h3 className="text-sm font-medium mb-2">Extracted Content</h3>
            <div className="border rounded bg-gray-50 p-4 overflow-y-auto flex-1 font-mono text-sm whitespace-pre-wrap max-h-[400px]">
              {previewContent || "No content extracted."}
            </div>
          </div>
          
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={handleCancelIndexing}>
              Cancel
            </Button>
            <Button onClick={handleConfirmIndexing}>
              <Check className="h-4 w-4 mr-2" />
              Add to Documents
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
export default DocumentsManager;
