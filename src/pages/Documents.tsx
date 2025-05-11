import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import { 
  Box, Button, Container, Typography, Paper, List, ListItem, ListItemText,
  ListItemSecondaryAction, IconButton, CircularProgress, Alert, Stack, Dialog,
  DialogTitle, DialogContent, DialogContentText, DialogActions, Skeleton, Pagination,
  FormControl, InputLabel, Select, MenuItem, SelectChangeEvent
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import { renderAsync } from 'docx-preview';
import { QueryClient, QueryClientProvider } from 'react-query';
import { useDocuments, Document, DocumentFile, FileType } from '../hooks/useDocuments';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      retry: 2,
      staleTime: 1000 * 60 * 5, // Cache for 5 minutes
      cacheTime: 1000 * 60 * 10, // Cache for 10 minutes
      refetchOnMount: 'always'
    },
  },
});

// Wrap the component with QueryClientProvider
export default function DocumentsPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <Documents />
    </QueryClientProvider>
  );
}

function Documents() {
  // File input reference
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Track selected document for viewing
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  
  // Track success and error messages
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Track delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);
  
  // Reference to the document viewer container
  const docViewerRef = useRef<HTMLDivElement>(null);
  
  // Loading state for document preview
  const [isDocumentLoading, setIsDocumentLoading] = useState(false);
  
  // Use our enhanced useDocuments hook with pagination
  const {
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
    
    // Operations
    uploadDocument,
    deleteDocument,
    getDocumentFile,
    getFileType,
    refetchDocuments,
    cleanup,
    
    // Pagination controls
    handlePageChange,
    setPageSize
  } = useDocuments();
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);
  
  // Handle file input change
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };
  
  // Handle file upload
  const handleFileUpload = (file: File) => {
    // Clear previous messages
    setSuccess(null);
    setError(null);
    
    uploadDocument(file);
  };
  
  // Trigger file input click
  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  // Open delete confirmation dialog
  const openDeleteDialog = (doc: Document) => {
    setDocumentToDelete(doc);
    setDeleteDialogOpen(true);
  };
  
  // Close delete confirmation dialog
  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setDocumentToDelete(null);
  };
  
  // Handle delete confirmation
  const handleDeleteConfirm = () => {
    if (documentToDelete) {
      deleteDocument(documentToDelete.id);
      closeDeleteDialog();
      
      // Set success message
      setSuccess("Document deleted successfully");
      
      // Clear after a few seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    }
  };
  
  // View a document
  const handleViewDocument = async (doc: Document) => {
    setSelectedDocument(doc);
    setViewDialogOpen(true);
    setIsDocumentLoading(true);
    
    console.log('Attempting to view document:', doc);
    
    try {
      // Get the document file
      console.log('Fetching document file...');
      const docFile = await getDocumentFile(doc);
      console.log('Document file response:', docFile);
      
      // If document is loaded and we have a reference to the viewer container
      if (docFile && docViewerRef.current) {
        const fileType = getFileType(doc);
        console.log('Document file type:', fileType);
        console.log('Document MIME type:', docFile.mimeType);
        
        // Clear previous content
        docViewerRef.current.innerHTML = '';
        
        if (fileType === 'docx') {
          console.log('Rendering DOCX file with docx-preview');
          try {
            // Render docx file
            await renderAsync(docFile.file, docViewerRef.current, null, {
              className: 'docx-viewer',
            });
          } catch (docxError) {
            console.error('Error rendering DOCX:', docxError);
            const errorMsg = document.createElement('div');
            errorMsg.className = 'error-message';
            errorMsg.textContent = 'Could not render DOCX file. Try downloading instead.';
            docViewerRef.current.appendChild(errorMsg);
            
            // Fallback to download link
            const link = document.createElement('a');
            link.href = docFile.url;
            link.download = doc.name;
            link.textContent = `Download ${doc.name}`;
            link.className = 'download-link';
            docViewerRef.current.appendChild(link);
          }
        } else if (fileType === 'pdf') {
          console.log('Rendering PDF file with embed element');
          // Create an embed element for PDF
          const embed = document.createElement('embed');
          embed.src = docFile.url;
          embed.width = '100%';
          embed.height = '500px';
          embed.type = 'application/pdf';
          
          // Create a fallback link in case embed doesn't work
          const fallbackContainer = document.createElement('div');
          fallbackContainer.className = 'fallback-container';
          fallbackContainer.style.marginTop = '10px';
          const fallbackLink = document.createElement('a');
          fallbackLink.href = docFile.url;
          fallbackLink.download = doc.name;
          fallbackLink.textContent = `Download ${doc.name}`;
          fallbackLink.className = 'download-link';
          
          docViewerRef.current.appendChild(embed);
          fallbackContainer.appendChild(fallbackLink);
          docViewerRef.current.appendChild(fallbackContainer);
          
          // Add an event listener to check if PDF loaded correctly
          embed.onerror = () => {
            console.error('PDF embed failed to load');
            const errorMsg = document.createElement('div');
            errorMsg.className = 'error-message';
            errorMsg.textContent = 'PDF preview failed to load. You can download the file instead.';
            docViewerRef.current?.insertBefore(errorMsg, fallbackContainer);
          };
        } else {
          console.log('Using download link for file type:', fileType);
          // For other file types, show a download link
          const link = document.createElement('a');
          link.href = docFile.url;
          link.download = doc.name;
          link.textContent = `Download ${doc.name}`;
          link.className = 'download-link';
          
          docViewerRef.current.appendChild(link);
        }
      } else {
        console.error('Missing document file or viewer reference', { 
          hasDocFile: !!docFile, 
          hasViewerRef: !!docViewerRef.current 
        });
        setError('Failed to load document file or viewer container');
      }
    } catch (err) {
      console.error('Error viewing document:', err);
      setError('Failed to load document for viewing');
      
      // Add error message to viewer if available
      if (docViewerRef.current) {
        docViewerRef.current.innerHTML = '';
        const errorMsg = document.createElement('div');
        errorMsg.className = 'error-message';
        errorMsg.textContent = 'Error loading document. Please try again.';
        docViewerRef.current.appendChild(errorMsg);
      }
    } finally {
      setIsDocumentLoading(false);
    }
  };
  
  // Close the view dialog
  const closeViewDialog = () => {
    setViewDialogOpen(false);
    setSelectedDocument(null);
  };
  
  // Handle page change event
  const onPageChange = (_event: React.ChangeEvent<unknown>, page: number) => {
    handlePageChange(page);
  };
  
  // Handle page size change
  const onPageSizeChange = (event: SelectChangeEvent<number>) => {
    const newSize = parseInt(event.target.value as string, 10);
    setPageSize(newSize);
  };
  
  // Page size options
  const pageSizeOptions = [5, 10, 25, 50];
  
  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };
  
  // Format date for display
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };
  
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">Documents</Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<UploadFileIcon />}
            onClick={triggerFileInput}
            disabled={isUploading}
          >
            {isUploading ? 'Uploading...' : 'Upload Document'}
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileChange}
            accept=".pdf,.docx,.doc,.txt,.csv,.md,.json,.xml"
          />
        </Box>
        
        {/* Success and Error Messages */}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {documentsError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Error loading documents: {documentsError.message}
          </Alert>
        )}
        {uploadError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Error uploading document: {uploadError.message}
          </Alert>
        )}
        {deleteError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Error deleting document: {deleteError.message}
          </Alert>
        )}
        
        {/* Document List with Pagination */}
        <Box sx={{ minHeight: 400 }}>
          {isLoadingDocuments ? (
            <Stack spacing={1}>
              {[...Array(3)].map((_, index) => (
                <Skeleton key={index} variant="rectangular" height={60} />
              ))}
            </Stack>
          ) : documents && documents.length > 0 ? (
            <List>
              {documents.map((doc) => (
                <ListItem
                  key={doc.id}
                  divider
                  sx={{
                    '&:hover': { bgcolor: 'action.hover' },
                    cursor: 'pointer',
                  }}
                  onClick={() => handleViewDocument(doc)}
                >
                  <ListItemText
                    primary={doc.name}
                    secondary={
                      <React.Fragment>
                        <Typography
                          component="span"
                          variant="body2"
                          color="text.primary"
                          sx={{ display: 'inline', mr: 1 }}
                        >
                          {doc.type?.toUpperCase() || 'UNKNOWN'}
                        </Typography>
                        {formatFileSize(doc.size)} • {formatDate(doc.uploadDate)}
                      </React.Fragment>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton edge="end" onClick={(e) => {
                      e.stopPropagation(); // Prevent triggering the ListItem click
                      openDeleteDialog(doc);
                    }}>
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
              <Typography variant="body1" color="text.secondary">
                No documents found. Upload a document to get started.
              </Typography>
            </Box>
          )}
        </Box>
        
        {/* Pagination Controls */}
        {totalCount > 0 && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mt: 2,
              pt: 2,
              borderTop: 1,
              borderColor: 'divider',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mr: 2 }}>
                Items per page:
              </Typography>
              <FormControl size="small" sx={{ width: 80 }}>
                <Select
                  value={pageSize}
                  onChange={onPageSizeChange}
                >
                  {pageSizeOptions.map(option => (
                    <MenuItem key={option} value={option}>{option}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                {totalCount} {totalCount === 1 ? 'item' : 'items'}
              </Typography>
            </Box>
            <Pagination 
              count={totalPages} 
              page={currentPage} 
              onChange={onPageChange} 
              color="primary" 
              showFirstButton 
              showLastButton
              disabled={isFetchingDocuments}
            />
          </Box>
        )}
        
        {/* View Document Dialog */}
        <Dialog
          open={viewDialogOpen}
          onClose={closeViewDialog}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            {selectedDocument?.name}
            <IconButton
              aria-label="download"
              onClick={() => {
                if (selectedDocument && documentFiles[selectedDocument.id]) {
                  const a = document.createElement('a');
                  a.href = documentFiles[selectedDocument.id].url;
                  a.download = selectedDocument.name;
                  a.click();
                }
              }}
              sx={{ position: 'absolute', right: 48, top: 8 }}
            >
              <DownloadIcon />
            </IconButton>
            <IconButton
              aria-label="close"
              onClick={closeViewDialog}
              sx={{ position: 'absolute', right: 8, top: 8 }}
            >
              <DeleteIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            {isDocumentLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Box ref={docViewerRef} sx={{ minHeight: 500 }} />
            )}
          </DialogContent>
        </Dialog>
        
        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteDialogOpen}
          onClose={closeDeleteDialog}
        >
          <DialogTitle>Delete Document</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete "{documentToDelete?.name}"? This action cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDeleteDialog}>Cancel</Button>
            <Button onClick={handleDeleteConfirm} color="error" autoFocus>
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </Container>
  );
}
