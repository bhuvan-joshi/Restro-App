import api from './api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface AgentQueryRequest {
  query: string;
  modelId: string;
  documentIds: string[];
  confidenceThreshold?: number;
  enableHumanEscalation?: boolean;
  progressiveMode?: "initial" | "enhanced";
  previousResponseId?: string;
  previousResponse?: string;
  maxTokens?: number;
}

interface DocumentReference {
  documentId: string;
  title: string;
  url: string;
  relevance: number;
}

interface AgentQueryResponse {
  responseId: string;
  response: string;
  confidence: number;
  needsHumanReview: boolean;
  sources: DocumentReference[];
  timestamp: string;
}

interface AgentFeedbackRequest {
  responseId: string;
  feedback: string; // "positive", "negative"
  comments?: string;
}

interface AgentModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  contextWindowSize: number;
  knowledgeCutoff: string;
  capabilities: string[];
  subscriptionLevel: string; // "free", "basic", "premium"
}

interface TestScenario {
  id: string;
  name: string;
  description: string;
  questions: string[];
}

interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onComplete: (response: AgentQueryResponse) => void;
  onError: (error: Error) => void;
}

// API functions
export const queryAgent = async (request: AgentQueryRequest): Promise<AgentQueryResponse> => {
  const response = await api.post<AgentQueryResponse>('/agent/query', request);
  return response.data;
};

// New streaming function
export const streamQueryAgent = async (
  request: AgentQueryRequest, 
  callbacks: StreamCallbacks
): Promise<void> => {
  try {
    // Setup event source for SSE
    const response = await fetch(`${api.defaults.baseURL}/agent/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward authentication token if available
        ...(localStorage.getItem('auth_token') ? {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        } : {}),
      },
      body: JSON.stringify(request)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Stream request failed: ${response.status} - ${errorText}`);
    }
    
    // Read the response as a stream
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Stream reader not available');
    }
    
    const decoder = new TextDecoder();
    let buffer = '';
    let responseData: Partial<AgentQueryResponse> = {};
    let accumulatedContent = '';
    
    // Process the stream
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        // End of stream, use accumulated data to create complete response
        if (accumulatedContent) {
          responseData.response = accumulatedContent;
        }
        
        // If we have response data, call onComplete
        if (Object.keys(responseData).length > 0) {
          callbacks.onComplete(responseData as AgentQueryResponse);
        } else {
          // Empty response, create a minimal valid response
          callbacks.onComplete({
            responseId: new Date().getTime().toString(),
            response: accumulatedContent,
            confidence: 1,
            needsHumanReview: false,
            sources: [],
            timestamp: new Date().toISOString()
          });
        }
        break;
      }
      
      // Process this chunk
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      
      // Split by lines and process each complete line
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep the last incomplete line in buffer
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine === 'data: [DONE]') {
          continue;
        }
        
        // Extract data payload - handle both JSON and plain text formats
        const match = trimmedLine.match(/^data: (.*)$/);
        if (!match) {
          // If it's not in data: format but has content, treat as plain text
          if (trimmedLine) {
            // Make sure the text doesn't contain any stray "data:" prefixes
            const cleanText = trimmedLine.replace(/\bdata:\s*/g, '');
            accumulatedContent += cleanText;
            callbacks.onChunk(cleanText);
          }
          continue;
        }
        
        const payload = match[1];
        
        // Try to parse as JSON, if it fails, treat as plain text
        try {
          const data = JSON.parse(payload);
          
          // If the data contains a stream chunk, forward it
          if (data.content || data.chunk || (data.choices && data.choices[0]?.delta?.content)) {
            // Handle different API response formats
            let content = '';
            
            if (data.content) {
              content = data.content;
            } else if (data.chunk) {
              content = data.chunk;
            } else if (data.choices && data.choices[0]?.delta?.content) {
              // Handle DeepSeek/OpenAI format
              content = data.choices[0].delta.content;
            }
            
            // Clean up any data prefixes
            content = content.replace(/\bdata:\s*/g, '');
            
            // Add to accumulated content and send to callback
            accumulatedContent += content;
            callbacks.onChunk(content);
          }
          
          // Save metadata for final response
          if (data.responseId) responseData.responseId = data.responseId;
          if (data.sources) responseData.sources = data.sources;
          if (data.needsHumanReview !== undefined) responseData.needsHumanReview = data.needsHumanReview;
          if (data.confidence !== undefined) responseData.confidence = data.confidence;
          
          // If this is a completion message
          if (data.status === 'complete') {
            // Ensure we have a response field with accumulated content
            responseData.response = accumulatedContent;
            responseData.timestamp = new Date().toISOString();
            callbacks.onComplete(responseData as AgentQueryResponse);
            return;
          }
        } catch (e) {
          // Not valid JSON, treat as plain text content
          // Clean any "data:" prefixes that might be in the text content
          const cleanPayload = payload.replace(/\bdata:\s*/g, '');
          accumulatedContent += cleanPayload;
          callbacks.onChunk(cleanPayload);
        }
      }
    }
  } catch (error) {
    callbacks.onError(error);
  }
};

export const getAvailableModels = async (): Promise<AgentModel[]> => {
  const response = await api.get<AgentModel[]>('/agent/models');
  return response.data;
};

export const submitAgentFeedback = async (request: AgentFeedbackRequest): Promise<{ success: boolean }> => {
  const response = await api.post<{ success: boolean }>('/agent/feedback', request);
  return response.data;
};

export const getTestScenarios = async (): Promise<TestScenario[]> => {
  const response = await api.get<TestScenario[]>('/agent/test-scenarios');
  return response.data;
};

// React Query hooks
export const useAgentQuery = () => {
  const queryClient = useQueryClient();
  
  return useMutation<
    AgentQueryResponse, 
    Error, 
    AgentQueryRequest
  >({
    mutationFn: queryAgent,
    onSuccess: (data) => {
      // Optionally invalidate queries or update cache
      queryClient.invalidateQueries({ queryKey: ['agentResponses'] });
    }
  });
};

export const useAvailableModels = () => {
  return useQuery<AgentModel[], Error>({
    queryKey: ['availableModels'],
    queryFn: () => getAvailableModels(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (previously cacheTime)
    retry: 2,
    refetchOnWindowFocus: false
  });
};

export const useAgentFeedback = () => {
  return useMutation<
    { success: boolean }, 
    Error, 
    AgentFeedbackRequest
  >({
    mutationFn: submitAgentFeedback
  });
};

export const useTestScenarios = () => {
  return useQuery<TestScenario[], Error>({
    queryKey: ['testScenarios'],
    queryFn: () => getTestScenarios(),
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (previously cacheTime)
    retry: 2,
    refetchOnWindowFocus: false
  });
};
