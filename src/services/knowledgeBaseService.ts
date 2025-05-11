import api from './api';

// Types for knowledge entries
export interface KnowledgeEntry {
  id: string; // This will be a string representation of the Guid
  title: string;
  content: string;
  sourceDocuments: string[];
  lastUpdated: Date;
  confidence: number;
  tags: string[];
}

// API functions for knowledge base
export const getKnowledgeEntries = async (page: number = 1, pageSize: number = 10): Promise<KnowledgeEntry[]> => {
  try {
    console.log(`Fetching documents from API with page=${page}, pageSize=${pageSize}...`);
    
    const response = await api.get('/Documents', {
      params: {
        page: page,
        pageSize: pageSize,
        excludeContent: false,
        t: Date.now() // Add cache-busting timestamp
      }
    });
    
    console.log('API response:', response.data);
    
    // Handle different response formats and ensure IDs are strings
    const processEntries = (entries: any[]): KnowledgeEntry[] => {
      return entries.map(entry => ({
        ...entry,
        id: entry.id?.toString() || '', // Convert Guid to string
        title: entry.name || entry.title || '',
        content: entry.content || '',
        sourceDocuments: entry.sourceDocuments || [],
        lastUpdated: entry.uploadDate ? new Date(entry.uploadDate) : new Date(),
        confidence: entry.confidence || 0.5,
        tags: entry.tags || []
      }));
    };
    
    if (Array.isArray(response.data)) {
      return processEntries(response.data);
    }
    
    if (response.data?.items && Array.isArray(response.data.items)) {
      return processEntries(response.data.items);
    }
    
    if (response.data?.data && Array.isArray(response.data.data)) {
      return processEntries(response.data.data);
    }
    
    if (response.data && typeof response.data === 'object' && response.data.id) {
      return processEntries([response.data]);
      }
    
    throw new Error('Invalid API response format');
  } catch (error) {
    console.error('Error fetching knowledge entries:', error);
    throw error;
  }
};

export const updateKnowledgeEntry = async (entry: KnowledgeEntry): Promise<KnowledgeEntry> => {
  try {
    const response = await api.put(`/Documents/${entry.id}`, {
      name: entry.title,
      tags: entry.tags
    });
    
    return {
      ...entry,
      ...response.data,
      id: response.data.id?.toString() || entry.id // Ensure ID is string
    };
  } catch (error) {
    console.error('Error updating knowledge entry:', error);
    throw error;
  }
};

export const deleteKnowledgeEntry = async (id: string): Promise<boolean> => {
  try {
    await api.delete(`/Documents/${id}`);
    return true;
  } catch (error) {
    console.error('Error deleting knowledge entry:', error);
    throw error;
  }
};

export const refreshKnowledgeBase = async (): Promise<KnowledgeEntry[]> => {
  try {
    console.log('Refreshing documents from API...');
    
    const response = await api.get('/Documents', {
      params: {
        page: 1,
        pageSize: 100,
        excludeContent: false,
        t: Date.now() // Add cache-busting timestamp
      }
    });
    
    console.log('API response:', response.data);
    
    // Handle different response formats and ensure IDs are strings
    const processEntries = (entries: any[]): KnowledgeEntry[] => {
      return entries.map(entry => ({
        ...entry,
        id: entry.id?.toString() || '', // Convert Guid to string
        title: entry.name || entry.title || '',
        content: entry.content || '',
        sourceDocuments: entry.sourceDocuments || [],
        lastUpdated: entry.uploadDate ? new Date(entry.uploadDate) : new Date(),
        confidence: entry.confidence || 0.5,
        tags: entry.tags || []
      }));
    };
    
    if (Array.isArray(response.data)) {
      return processEntries(response.data);
    }
    
    if (response.data?.items && Array.isArray(response.data.items)) {
      return processEntries(response.data.items);
    }
    
    if (response.data?.data && Array.isArray(response.data.data)) {
      return processEntries(response.data.data);
    }
    
    if (response.data && typeof response.data === 'object' && response.data.id) {
      return processEntries([response.data]);
      }
    
    throw new Error('Invalid API response format');
  } catch (error) {
    console.error('Error refreshing knowledge base:', error);
    throw error;
  }
};
