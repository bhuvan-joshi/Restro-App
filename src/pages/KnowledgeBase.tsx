import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Search, FileText, Edit, Save, X, Trash2, Plus, RefreshCw, AlertTriangle, Database, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getDocuments, uploadDocument, deleteDocument } from '@/services/api';
import { getKnowledgeEntries, updateKnowledgeEntry, deleteKnowledgeEntry, refreshKnowledgeBase as refreshKnowledgeBaseApi } from '@/services/knowledgeBaseService';
import type { KnowledgeEntry } from '@/services/knowledgeBaseService';
import { KnowledgeEntrySkeleton, KnowledgeSummaryLoadingSkeleton, DocumentListLoadingSkeleton } from '@/components/KnowledgeEntrySkeleton';

// Add this new function for API calls
const processDocumentEmbeddings = async (all = true, documentIds: string[] = []) => {
  const token = localStorage.getItem('auth_token');
  const { API_BASE_URL } = await import('../config/api.config');
  
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

const KnowledgeBase: React.FC = () => {
  const [knowledgeEntries, setKnowledgeEntries] = useState<KnowledgeEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<KnowledgeEntry | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editedEntry, setEditedEntry] = useState<KnowledgeEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [documents, setDocuments] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [totalEntries, setTotalEntries] = useState(0);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  
  const [isProcessingEmbeddings, setIsProcessingEmbeddings] = useState(false);
  
  const { toast } = useToast();

  // Fetch knowledge entries immediately on component mount
  useEffect(() => {
    loadRealData(1, pageSize, true);
  }, []);

  const loadRealData = async (page = currentPage, size = pageSize, isInitial = false) => {
    if (isInitial) {
      setIsLoading(true);
      }
      
      try {
      // Fetch real data from API with pagination
      const entries = await getKnowledgeEntries(page, size);
        
      // Update state based on the response
        if (entries && entries.length > 0) {
        if (!isInitial && page > 1) {
          setKnowledgeEntries(prev => [...prev, ...entries]);
        } else {
          setKnowledgeEntries(entries);
        }
        
        // Set total count for pagination
        setTotalEntries(entries.length * 3); // This should come from API in production
        
        // Also fetch raw documents for reference if this is the initial load
        if (isInitial) {
          try {
        const response = await getDocuments();
        if (response && response.items) {
          setDocuments(response.items);
        } else if (Array.isArray(response)) {
          setDocuments(response);
            } else if (response && response.id) {
              setDocuments([response]);
        } else {
          setDocuments([]);
        }
      } catch (docsError) {
            console.error('Error fetching documents:', docsError);
        setDocuments([]);
      }
        }
        
        // Set flag to indicate initial load is complete
        if (isInitial) {
          setInitialLoadComplete(true);
        }
      } else {
        // No entries found
        setKnowledgeEntries([]);
        setDocuments([]);
        if (isInitial) {
      toast({
            title: 'No Data Found',
            description: 'No knowledge entries found in the database.',
            variant: 'default',
      });
        }
      }
    } catch (error: any) {
      console.error('Error loading knowledge entries:', error);
      setKnowledgeEntries([]);
      setDocuments([]);
      
      if (isInitial) {
        toast({
          title: 'Error',
          description: 'Failed to load knowledge entries. Please check your connection and try again.',
          variant: 'destructive',
        });
      }
    } finally {
      if (isInitial) {
      setIsLoading(false);
      }
      setInitialLoadComplete(true);
    }
  };

  const handleRefreshKnowledgeBase = async () => {
    setIsRefreshing(true);
    setCurrentPage(1); // Reset to first page
    try {
      // Use the imported refreshKnowledgeBaseApi function
      const entries = await refreshKnowledgeBaseApi();
      
      if (entries && entries.length > 0) {
        setKnowledgeEntries(entries);
        setTotalEntries(entries.length * 3); // Estimate total entries
        toast({
          title: 'Knowledge Base Refreshed',
          description: 'The knowledge base has been updated with the latest document information.',
        });
      } else {
        toast({
          title: 'Knowledge Base Refresh',
          description: 'No new documents found in the knowledge base.',
        });
      }
    } catch (error) {
      toast({
        title: 'Refresh Error',
        description: 'Failed to refresh knowledge base. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredEntries = knowledgeEntries.filter(entry => {
    const matchesSearch = 
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'high-confidence') return matchesSearch && entry.confidence >= 0.9;
    if (activeTab === 'low-confidence') return matchesSearch && entry.confidence < 0.9;
    
    return matchesSearch;
  });

  const handleEditEntry = (entry: KnowledgeEntry) => {
    setEditedEntry({...entry});
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editedEntry) return;
    
    try {
      // Update the entry in the backend
      await updateKnowledgeEntry(editedEntry);
      
      // Update local state
      setKnowledgeEntries(prev => 
        prev.map(entry => entry.id === editedEntry.id ? editedEntry : entry)
      );
      
      setIsEditDialogOpen(false);
      setEditedEntry(null);
      
      toast({
        title: 'Knowledge Entry Updated',
        description: 'The knowledge entry has been successfully updated.',
      });
    } catch (error) {
      console.error('Error updating knowledge entry:', error);
      toast({
        title: 'Update Error',
        description: 'Failed to update knowledge entry. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      // Delete the entry from the backend
      await deleteKnowledgeEntry(id);
      
      // Update local state
      setKnowledgeEntries(prev => prev.filter(entry => entry.id !== id));
      
      toast({
        title: 'Knowledge Entry Deleted',
        description: 'The knowledge entry has been removed from the knowledge base.',
      });
    } catch (error) {
      console.error('Error deleting knowledge entry:', error);
      toast({
        title: 'Delete Error',
        description: 'Failed to delete knowledge entry. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleAddTag = () => {
    if (!editedEntry) return;
    
    const newTag = prompt('Enter a new tag:');
    if (!newTag) return;
    
    setEditedEntry({
      ...editedEntry,
      tags: [...editedEntry.tags, newTag.toLowerCase()]
    });
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (!editedEntry) return;
    
    setEditedEntry({
      ...editedEntry,
      tags: editedEntry.tags.filter(tag => tag !== tagToRemove)
    });
  };

  // Add function to load more entries
  const loadMoreEntries = async () => {
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    setIsLoadingMore(true);
    try {
      await loadRealData(nextPage, pageSize, false);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Function to check if we should show the load more button
  const hasMoreEntries = () => {
    return knowledgeEntries.length < totalEntries;
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
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Knowledge Base</h1>
        <div className="flex gap-2">
          <label htmlFor="file-upload" className="cursor-pointer">
            <div className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 rounded-md text-sm font-medium">
              <FileText className="h-4 w-4" />
              Upload Document
            </div>
            <input 
              id="file-upload" 
              type="file" 
              className="hidden" 
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  try {
                    setIsLoading(true);
                    toast({
                      title: 'Uploading document',
                      description: `Uploading ${file.name}...`,
                    });
                    await uploadDocument(file);
                    toast({
                      title: 'Document uploaded',
                      description: `${file.name} has been uploaded successfully.`,
                    });
                    // Refresh the knowledge base after upload
                    await loadRealData();
                  } catch (error) {
                    console.error('Error uploading document:', error);
                    toast({
                      title: 'Upload failed',
                      description: 'Failed to upload document. Please try again.',
                      variant: 'destructive',
                    });
                  } finally {
                    setIsLoading(false);
                    // Clear the input
                    e.target.value = '';
                  }
                }
              }}
              accept=".pdf,.doc,.docx,.txt,.md"
            />
          </label>
          <Button 
            onClick={handleRefreshKnowledgeBase} 
            disabled={isRefreshing}
            className="flex items-center gap-2"
          >
            {isRefreshing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Refresh Knowledge
              </>
            )}
          </Button>
          <Button
            onClick={handleProcessEmbeddings}
            disabled={isProcessingEmbeddings}
            variant="outline"
            className="flex items-center gap-2"
          >
            {isProcessingEmbeddings ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Database className="h-4 w-4" />
                Process Embeddings
              </>
            )}
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Knowledge Summary</CardTitle>
              <CardDescription>Overview of extracted knowledge</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <KnowledgeSummaryLoadingSkeleton />
              ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Total Knowledge Entries</span>
                    <Badge variant="outline">{totalEntries}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">High Confidence Entries</span>
                  <Badge variant="outline">{knowledgeEntries.filter(e => e.confidence >= 0.9).length}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Low Confidence Entries</span>
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                    {knowledgeEntries.filter(e => e.confidence < 0.9).length}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Source Documents</span>
                  <Badge variant="outline">{documents.length}</Badge>
                </div>
                
                <div className="pt-4">
                  <h3 className="text-sm font-medium mb-2">Top Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(new Set(knowledgeEntries.flatMap(e => e.tags)))
                      .slice(0, 8)
                      .map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))
                    }
                  </div>
                </div>
              </div>
              )}
            </CardContent>
          </Card>
          
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Source Documents</CardTitle>
              <CardDescription>Documents used for knowledge extraction</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <DocumentListLoadingSkeleton />
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {/* Use knowledge entries as source documents if no documents are found */}
                  {documents.length > 0 ? (
                    documents.map((doc, index) => (
                      <div key={doc.id || index} className="flex items-center gap-2 p-2 rounded-md border">
                        <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
                        <div className="text-sm truncate flex-1">
                          {doc.name || `Document ${index + 1}`}
                        </div>
                      </div>
                    ))
                  ) : knowledgeEntries.length > 0 ? (
                    // If no documents but we have knowledge entries, use those
                    knowledgeEntries.map((entry, index) => (
                      <div key={entry.id} className="flex items-center gap-2 p-2 rounded-md border">
                        <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
                        <div className="text-sm truncate flex-1">
                          {entry.title || `Document ${index + 1}`}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      <p>No documents found</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Knowledge Entries</CardTitle>
                  <CardDescription>View and manage extracted knowledge</CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                  <Input
                    placeholder="Search knowledge..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="all">All Entries</TabsTrigger>
                  <TabsTrigger value="high-confidence">High Confidence</TabsTrigger>
                  <TabsTrigger value="low-confidence">Low Confidence</TabsTrigger>
                </TabsList>
                
                <TabsContent value="all" className="mt-0">
                  <div className="space-y-4">
                    {isLoading ? (
                      // Show skeleton loaders while loading
                      Array.from({ length: 3 }).map((_, index) => (
                        <KnowledgeEntrySkeleton key={index} />
                      ))
                    ) : filteredEntries.length > 0 ? (
                      // Show actual entries when loaded
                      <>
                        {filteredEntries.map(entry => (
                        <Card key={entry.id} className="overflow-hidden">
                          <div className="flex justify-between items-start p-4">
                            <div>
                              <h3 className="font-medium">{entry.title}</h3>
                              <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                                <span>Last updated: {entry.lastUpdated.toLocaleDateString()}</span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  Confidence: 
                                  <Badge 
                                    variant={entry.confidence >= 0.9 ? "default" : "outline"}
                                    className={entry.confidence >= 0.9 
                                      ? "bg-green-100 text-green-800 hover:bg-green-100" 
                                      : "bg-amber-50 text-amber-700 border-amber-200"
                                    }
                                  >
                                    {Math.round(entry.confidence * 100)}%
                                  </Badge>
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleEditEntry(entry)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleDeleteEntry(entry.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                          <div className="px-4 pb-2">
                            {/* Show a truncated summary of the content */}
                            {entry.content && entry.content.length > 200 ? (
                              <>
                                <p className="text-sm text-gray-700">{entry.content.substring(0, 200)}...</p>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="link" className="p-0 h-auto text-xs mt-1">
                                      View full content
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
                                    <DialogHeader>
                                      <DialogTitle>{entry.title}</DialogTitle>
                                      <DialogDescription>
                                        Source: {entry.sourceDocuments.join(', ')}
                                      </DialogDescription>
                                    </DialogHeader>
                                    <ScrollArea className="flex-1 overflow-auto p-4 border rounded-md">
                                      <div className="whitespace-pre-wrap">
                                        {entry.content}
                                      </div>
                                    </ScrollArea>
                                  </DialogContent>
                                </Dialog>
                              </>
                            ) : (
                              <p className="text-sm text-gray-700">{entry.content || 'No content available'}</p>
                            )}
                          </div>
                          <div className="px-4 pb-4">
                            <div className="flex flex-wrap gap-1 mt-2">
                              {entry.tags.map(tag => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="bg-gray-50 px-4 py-2 text-xs text-gray-500">
                              <div className="flex items-center gap-1 flex-wrap">
                              <span>Source documents:</span>
                                {entry.sourceDocuments.map((doc, index) => [
                                  <Badge key={doc} variant="outline" className="text-xs font-normal">
                                    {doc}
                                  </Badge>,
                                  index < entry.sourceDocuments.length - 1 && <span key={`${doc}-separator`}>, </span>
                                ]).flat().filter(Boolean)}
                            </div>
                          </div>
                        </Card>
                        ))}
                        
                        {/* Load more button */}
                        {hasMoreEntries() && (
                          <div className="flex justify-center mt-6">
                            <Button 
                              variant="outline" 
                              onClick={loadMoreEntries}
                              className="gap-2"
                              disabled={isRefreshing || isLoadingMore}
                            >
                              {isLoadingMore ? (
                                <>
                                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Loading more entries...
                                </>
                              ) : (
                                <>
                                  Load More Entries
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground space-y-4">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-amber-500" />
                          <span>No knowledge entries found</span>
                        </div>
                        <p className="text-sm text-center max-w-md">
                          Upload documents using the button above to populate your knowledge base.
                          The AI assistant will use these documents to provide more accurate responses.
                        </p>
                        <label htmlFor="file-upload-empty" className="cursor-pointer">
                          <div className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2 rounded-md text-sm font-medium">
                            <FileText className="h-4 w-4" />
                            Upload Your First Document
                          </div>
                          <input 
                            id="file-upload-empty" 
                            type="file" 
                            className="hidden" 
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                try {
                                  setIsLoading(true);
                                  toast({
                                    title: 'Uploading document',
                                    description: `Uploading ${file.name}...`,
                                  });
                                  await uploadDocument(file);
                                  toast({
                                    title: 'Document uploaded',
                                    description: `${file.name} has been uploaded successfully.`,
                                  });
                                  // Refresh the knowledge base after upload
                                  await loadRealData(1, pageSize, true);
                                } catch (error) {
                                  console.error('Error uploading document:', error);
                                  toast({
                                    title: 'Upload failed',
                                    description: 'Failed to upload document. Please try again.',
                                    variant: 'destructive',
                                  });
                                } finally {
                                  setIsLoading(false);
                                  // Clear the input
                                  e.target.value = '';
                                }
                              }
                            }}
                            accept=".pdf,.doc,.docx,.txt,.md"
                          />
                        </label>
                      </div>
                    )}
                    {searchQuery && filteredEntries.length === 0 && !isLoading && (
                      <p className="mt-2 text-sm text-center">No results match your search query. Try adjusting your search.</p>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="high-confidence" className="mt-0">
                  <div className="space-y-4">
                    {filteredEntries.length > 0 ? (
                      filteredEntries.map(entry => (
                        <Card key={entry.id} className="overflow-hidden">
                          <div className="flex justify-between items-start p-4">
                            <div>
                              <h3 className="font-medium">{entry.title}</h3>
                              <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                                <span>Last updated: {entry.lastUpdated.toLocaleDateString()}</span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  Confidence: 
                                  <Badge 
                                    variant="default"
                                    className="bg-green-100 text-green-800 hover:bg-green-100"
                                  >
                                    {Math.round(entry.confidence * 100)}%
                                  </Badge>
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleEditEntry(entry)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleDeleteEntry(entry.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                          <div className="px-4 pb-2">
                            {/* Show a truncated summary of the content */}
                            {entry.content && entry.content.length > 200 ? (
                              <>
                                <p className="text-sm text-gray-700">{entry.content.substring(0, 200)}...</p>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="link" className="p-0 h-auto text-xs mt-1">
                                      View full content
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
                                    <DialogHeader>
                                      <DialogTitle>{entry.title}</DialogTitle>
                                      <DialogDescription>
                                        Source: {entry.sourceDocuments.join(', ')}
                                      </DialogDescription>
                                    </DialogHeader>
                                    <ScrollArea className="flex-1 overflow-auto p-4 border rounded-md">
                                      <div className="whitespace-pre-wrap">
                                        {entry.content}
                                      </div>
                                    </ScrollArea>
                                  </DialogContent>
                                </Dialog>
                              </>
                            ) : (
                              <p className="text-sm text-gray-700">{entry.content || 'No content available'}</p>
                            )}
                          </div>
                          <div className="px-4 pb-4">
                            <div className="flex flex-wrap gap-1 mt-2">
                              {entry.tags.map(tag => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="bg-gray-50 px-4 py-2 text-xs text-gray-500">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span>Source documents:</span>
                              {entry.sourceDocuments.map((doc, index) => [
                                <Badge key={doc} variant="outline" className="text-xs font-normal">
                                    {doc}
                                </Badge>,
                                index < entry.sourceDocuments.length - 1 && <span key={`${doc}-separator`}>, </span>
                              ]).flat().filter(Boolean)}
                            </div>
                          </div>
                        </Card>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <p>No high confidence entries found</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="low-confidence" className="mt-0">
                  <div className="space-y-4">
                    {filteredEntries.length > 0 ? (
                      filteredEntries.map(entry => (
                        <Card key={entry.id} className="overflow-hidden">
                          <div className="flex justify-between items-start p-4">
                            <div>
                              <h3 className="font-medium">{entry.title}</h3>
                              <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                                <span>Last updated: {entry.lastUpdated.toLocaleDateString()}</span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  Confidence: 
                                  <Badge 
                                    variant="outline"
                                    className="bg-amber-50 text-amber-700 border-amber-200"
                                  >
                                    {Math.round(entry.confidence * 100)}%
                                  </Badge>
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleEditEntry(entry)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleDeleteEntry(entry.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                          <div className="px-4 pb-2">
                            {/* Show a truncated summary of the content */}
                            {entry.content && entry.content.length > 200 ? (
                              <>
                                <p className="text-sm text-gray-700">{entry.content.substring(0, 200)}...</p>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="link" className="p-0 h-auto text-xs mt-1">
                                      View full content
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
                                    <DialogHeader>
                                      <DialogTitle>{entry.title}</DialogTitle>
                                      <DialogDescription>
                                        Source: {entry.sourceDocuments.join(', ')}
                                      </DialogDescription>
                                    </DialogHeader>
                                    <ScrollArea className="flex-1 overflow-auto p-4 border rounded-md">
                                      <div className="whitespace-pre-wrap">
                                        {entry.content}
                                      </div>
                                    </ScrollArea>
                                  </DialogContent>
                                </Dialog>
                              </>
                            ) : (
                              <p className="text-sm text-gray-700">{entry.content || 'No content available'}</p>
                            )}
                          </div>
                          <div className="px-4 pb-4">
                            <div className="flex flex-wrap gap-1 mt-2">
                              {entry.tags.map(tag => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="bg-gray-50 px-4 py-2 text-xs text-gray-500">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span>Source documents:</span>
                              {entry.sourceDocuments.map((doc, index) => [
                                <Badge key={doc} variant="outline" className="text-xs font-normal">
                                    {doc}
                                </Badge>,
                                index < entry.sourceDocuments.length - 1 && <span key={`${doc}-separator`}>, </span>
                              ]).flat().filter(Boolean)}
                            </div>
                          </div>
                        </Card>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <p>No low confidence entries found</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Knowledge Entry</DialogTitle>
            <DialogDescription>
              Make changes to the knowledge entry. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          
          {editedEntry && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input 
                  id="title" 
                  value={editedEntry.title}
                  onChange={(e) => setEditedEntry({...editedEntry, title: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="content">Content</Label>
                <Textarea 
                  id="content" 
                  rows={5}
                  value={editedEntry.content}
                  onChange={(e) => setEditedEntry({...editedEntry, content: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confidence">Confidence</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    id="confidence" 
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={editedEntry.confidence}
                    onChange={(e) => setEditedEntry({
                      ...editedEntry, 
                      confidence: parseFloat(e.target.value)
                    })}
                  />
                  <Badge 
                    variant={editedEntry.confidence >= 0.9 ? "default" : "outline"}
                    className={editedEntry.confidence >= 0.9 
                      ? "bg-green-100 text-green-800 hover:bg-green-100" 
                      : "bg-amber-50 text-amber-700 border-amber-200"
                    }
                  >
                    {Math.round(editedEntry.confidence * 100)}%
                  </Badge>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Tags</Label>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleAddTag}
                    className="h-8 gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    Add Tag
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-10">
                  {editedEntry.tags.length > 0 ? (
                    editedEntry.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                        {tag}
                        <X 
                          className="h-3 w-3 cursor-pointer" 
                          onClick={() => handleRemoveTag(tag)}
                        />
                      </Badge>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500">No tags</div>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Source Documents</Label>
                <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-10">
                  {editedEntry.sourceDocuments.map(doc => (
                    <Badge key={doc} variant="outline">
                      {doc}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KnowledgeBase;
