import React, { useState, useRef, useEffect } from 'react';
import '../styles/agentTesting.css';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { API_BASE_URL } from '@/config/api.config';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import TypewriterText from '../components/TypewriterText';
import { 
  Send, 
  User, 
  Bot, 
  ThumbsUp, 
  ThumbsDown, 
  AlertTriangle, 
  FileText, 
  RefreshCw,
  Settings,
  CheckCircle,
  XCircle,
  Info,
  Loader2
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { getDocuments } from '@/services/api';
// Import API services with React Query hooks
import { useAgentQuery, useAvailableModels, useAgentFeedback, useTestScenarios } from '@/services/agentService';
import { useQueryClient } from '@tanstack/react-query';
import { streamQueryAgent } from '../services/agentService';

// Types for messages
interface Message {
  id: string;
  content: string;
  sender: 'user' | 'agent';
  timestamp: Date;
  sources?: { title: string; url: string }[];
  feedback?: 'positive' | 'negative';
  needsHumanReview?: boolean;
  isStreaming?: boolean;
  streamedContent?: string;
  progressiveStage?: number; // 0: initial, 1: basic response, 2: enhanced with docs
}

// Types for agent models and test scenarios
interface AgentModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  contextWindowSize: number;
  knowledgeCutoff: string;
  capabilities: string[];
  subscriptionLevel: string;
}

interface TestScenario {
  id: string;
  name: string;
  description: string;
  questions: string[];
}

// Default models and scenarios to use if API calls fail
const defaultModels: AgentModel[] = [
  {
    id: "llama3.2:latest",
    name: "Llama 3.2 (3B)",
    provider: "Ollama",
    description: "Open-source model suitable for general tasks",
    contextWindowSize: 8192,
    knowledgeCutoff: "2023-12",
    capabilities: ["Text Generation", "Q&A", "Summarization"],
    subscriptionLevel: "free"
  },
  {
    id: "mistral:latest",
    name: "Mistral 7B",
    provider: "Ollama",
    description: "Open-source model with strong reasoning capabilities",
    contextWindowSize: 8192,
    knowledgeCutoff: "2023-12",
    capabilities: ["Text Generation", "Q&A", "Reasoning"],
    subscriptionLevel: "free"
  }
];

// No default scenarios needed as we generate them from knowledge base documents

const AgentTesting = () => {
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  
  // State for messages, input, and settings
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  // State for models and documents
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  
  // State for test scenarios
  const [selectedScenario, setSelectedScenario] = useState<TestScenario | null>(null);
  
  // State for settings
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.7);
  const [enableHumanEscalation, setEnableHumanEscalation] = useState(true);
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  // Add a new state to track response timing
  const [responseStartTime, setResponseStartTime] = useState<number | null>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);

  // Add new state variables for progressive response
  const [isProgressiveResponse, setIsProgressiveResponse] = useState(true);
  const [isResponseEnhancing, setIsResponseEnhancing] = useState(false);

  // React Query hooks
  const agentQuery = useAgentQuery();
  const modelsQuery = useAvailableModels();
  const feedbackMutation = useAgentFeedback();
  const scenariosQuery = useTestScenarios();
  
  // Set selected model when models are loaded
  useEffect(() => {
    if (modelsQuery.data && modelsQuery.data.length > 0 && !selectedModel) {
      // Try to find an Ollama model first or fall back to the first model
      const ollamaModel = modelsQuery.data.find(m => m.provider === 'Ollama');
      setSelectedModel(ollamaModel ? ollamaModel.id : modelsQuery.data[0].id);
      
      toast({
        title: 'Models Loaded',
        description: `Found ${modelsQuery.data.length} available models including ${modelsQuery.data.filter(m => m.provider === 'Ollama').length} local models.`,
        variant: 'default',
      });
    } else if (modelsQuery.isError) {
      console.error('Error fetching models:', modelsQuery.error);
      toast({
        title: 'API Error',
        description: 'Could not load models from the server. Using default model settings.',
        variant: 'destructive',
      });
      // Fallback to default model if API fails
      setSelectedModel('gpt-4o');
    }
  }, [modelsQuery.isError, modelsQuery.error, modelsQuery.data, selectedModel, toast]);
  
  // Generate test scenarios from knowledge base documents
  useEffect(() => {
    // Generate scenarios when documents are loaded
    if (documents.length > 0) {
      console.log('Generating test scenarios from knowledge documents');
      
      // Create a map to group questions by document category/type
      const scenarioMap = new Map();
      
      // Process each document to extract potential questions
      documents.forEach(doc => {
        // Use document name or type as category
        const category = doc.name?.split('.')[0] || 'General';
        
        if (!scenarioMap.has(category)) {
          scenarioMap.set(category, {
            id: `generated-${category.toLowerCase().replace(/\s+/g, '-')}`,
            name: `${category} Questions`,
            description: `Questions related to ${category} documents`,
            questions: []
          });
        }
        
        // Generate 2-3 questions based on document content if available
        if (doc.content) {
          // Simple question generation based on content
          const questions = [
            `What information do we have about ${doc.name || category}?`,
            `Can you summarize the key points from ${doc.name || category}?`
          ];
          
          // Add a third question if document has a specific type or format
          if (doc.contentType || doc.fileType) {
            questions.push(`What format is the ${doc.name || category} document in?`);
          }
          
          // Add questions to the scenario
          scenarioMap.get(category).questions.push(...questions);
        }
      });
      
      // Convert map to array of scenarios
      const generatedScenarios = Array.from(scenarioMap.values());
      
      // Add a general scenario for testing the agent with the knowledge base
      generatedScenarios.push({
        id: 'generated-general',
        name: 'General Knowledge Questions',
        description: 'Test how the agent uses the entire knowledge base',
        questions: [
          'What are the most important topics in our knowledge base?',
          'Can you summarize what information we have available?',
          'What documents do we have in the knowledge base?'
        ]
      });
      
      console.log('Generated scenarios:', generatedScenarios);
      
      // Set the generated scenarios
      if (generatedScenarios.length > 0) {
        // Store the generated scenarios in a local state instead of modifying scenariosQuery.data
        const localScenarios = generatedScenarios;
        
        // Use React Query's setQueryData to update the cache properly
        queryClient.setQueryData(['testScenarios'], localScenarios);
        
        // Select the first scenario by default if none is selected
        if (!selectedScenario) {
          setSelectedScenario(generatedScenarios[0]);
        }
      }
    }
  }, [documents, selectedScenario]);

  // Fetch documents on component mount
  useEffect(() => {
    fetchDocuments();
  }, []);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchDocuments = async () => {
    setLoadingDocuments(true);
    try {
      // Direct API call with detailed logging
      console.log('Making direct API call to fetch documents');
      
      // Use fetch directly to bypass any potential issues with the API service
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      };
      
      const url = `${API_BASE_URL}/Documents?page=1&pageSize=100&excludeContent=false`;
      console.log('Fetching from URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Raw API response:', data);
      
      // Process the response
      if (data.items && Array.isArray(data.items)) {
        console.log(`Found ${data.items.length} documents in paginated response`);
        setDocuments(data.items);
      } else if (Array.isArray(data)) {
        console.log(`Found ${data.length} documents in array response`);
        setDocuments(data);
      } else {
        console.error('Unexpected API response format:', data);
        setDocuments([]);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: 'API Error',
        description: `Failed to fetch documents: ${error.message}`,
        variant: 'destructive',
      });
      setDocuments([]);
    } finally {
      setLoadingDocuments(false);
    }
  };

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  };

  // Add a helper function for generating truly unique IDs
  const generateUniqueId = (() => {
    let counter = 0;
    return () => {
      const timestamp = Date.now();
      const uniqueId = `${timestamp}-${counter++}`;
      return uniqueId;
    };
  })();

  const handleSendMessage = () => {
    if (!inputValue.trim() || isTyping) return;
    
    // Add user message with unique ID
    const userMessage: Message = {
      id: generateUniqueId(),
      content: inputValue,
      sender: 'user',
      timestamp: new Date(),
      isStreaming: false // Explicitly set this to false for user messages
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    
    // Generate agent response
    generateAgentResponse(inputValue);
  };

  const generateAgentResponse = async (userInput: string) => {
    setIsTyping(true);
    setResponseStartTime(Date.now());
    setResponseTime(null);
    
    try {
      // Create a placeholder message for streaming with unique ID
      const placeholderId = generateUniqueId();
      const placeholderMessage: Message = {
        id: placeholderId,
        content: '',
        streamedContent: '',
        sender: 'agent',
        timestamp: new Date(),
        isStreaming: true
      };
      
      // Add the placeholder message but hide it while streaming
      setMessages(prev => [...prev, placeholderMessage]);
      
      // Immediately scroll to the bottom
      setTimeout(() => scrollToBottom(), 50);
      
      // Create standard request
      const request = {
        query: userInput,
        modelId: selectedModel,
        documentIds: selectedDocuments,
        confidenceThreshold: confidenceThreshold,
        enableHumanEscalation: enableHumanEscalation
      };
      
      // If progressive mode is enabled and there are documents, indicate this in the UI
      if (isProgressiveResponse && selectedDocuments.length > 0) {
        setIsResponseEnhancing(true);
      }
      
      // Make the request
      await streamQueryAgent(request, {
        onChunk: (chunk) => {
          // Update the streamedContent but only show "..." while streaming
          // IMPORTANT: Only update the most recent agent message, never modify user messages
          setMessages(prev => {
            // Find the most recent agent message (the placeholder)
            const latestAgentMessageIndex = prev.findIndex(msg => 
              msg.id === placeholderId && msg.sender === 'agent'
            );
            
            if (latestAgentMessageIndex === -1) return prev; // Safety check
            
            // Create a new messages array with the updated agent message
            return prev.map((msg, index) => {
              // Only update the specific agent message by index
              if (index === latestAgentMessageIndex) {
                // Clean up any "data:" prefixes in the incoming chunk
                const cleanChunk = chunk.replace(/\bdata:\s*/g, '');
                
                return { 
                  ...msg,
                  streamedContent: (msg.streamedContent || '') + cleanChunk,
                  isStreaming: true
                };
              }
              return msg; // Return all other messages unchanged
            });
          });
          
          // Scroll to keep the message visible
          setTimeout(() => scrollToBottom(), 50);
        },
        onComplete: (response) => {
          console.log('Completed streaming response:', response);
          
          // Calculate response time
          if (responseStartTime) {
            const endTime = Date.now();
            const elapsed = endTime - responseStartTime;
            setResponseTime(elapsed);
            console.log(`Response generated in ${elapsed}ms`);
          }
          
          // Update the message with the complete response
          // IMPORTANT: Only update the agent message, never modify user messages
          setMessages(prev => {
            // Find the most recent agent message (the placeholder)
            const latestAgentMessageIndex = prev.findIndex(msg => 
              msg.id === placeholderId && msg.sender === 'agent'
            );
            
            if (latestAgentMessageIndex === -1) return prev; // Safety check
            
            // Create a new messages array with the updated agent message
            return prev.map((msg, index) => {
              // Only update the specific agent message by index
              if (index === latestAgentMessageIndex) {
                // Filter out thinking process
                let content = msg.streamedContent || '';
                content = content.replace(/<think>[\s\S]*?<\/think>/g, '');
                
                // Additional cleanup to remove any remaining "data:" prefixes
                content = content.replace(/\bdata:\s*/g, '');
                
                return { 
                  ...msg, 
                  id: response.responseId || placeholderId,
                  content: content,
                  isStreaming: false,
                  sources: response.sources?.map(source => ({
                    title: source.title || 'Document',
                    url: source.url || `/documents/${source.documentId}`
                  })),
                  needsHumanReview: response.needsHumanReview
                };
              }
              return msg; // Return all other messages unchanged
            });
          });
          
          // Show notification if human review is needed
          if (response.needsHumanReview) {
            toast({
              title: 'Human Review Needed',
              description: 'The agent is not confident in its response and has flagged it for human review.',
              variant: 'destructive',
            });
          }
          
          setIsTyping(false);
          setIsResponseEnhancing(false);
          setTimeout(() => scrollToBottom(), 50);
        },
        onError: (error) => {
          console.error('Error generating response:', error);
          
          // Update the placeholder with an error message
          setMessages(prev => 
            prev.map(msg => 
              msg.id === placeholderId 
                ? { 
                    ...msg, 
                    content: 'I apologize, but I encountered an error while processing your request. Please try again later.',
                    isStreaming: false,
                    needsHumanReview: true
                  } 
                : msg
            )
          );
          
          toast({
            title: 'Error',
            description: 'Failed to generate a response: ' + (error.message || 'Unknown error'),
            variant: 'destructive',
          });
          
          setIsTyping(false);
          setIsResponseEnhancing(false);
          setTimeout(() => scrollToBottom(), 50);
        }
      });
    } catch (error) {
      console.error('Error generating response:', error);
      
      // Add a fallback error message with unique ID
      const errorMessage: Message = {
        id: generateUniqueId(),
        content: 'I apologize, but I encountered an error while processing your request. Please try again later.',
        sender: 'agent',
        timestamp: new Date(),
        needsHumanReview: true
      };
      
      setMessages((prev) => [...prev, errorMessage]);
      
      toast({
        title: 'Error',
        description: 'Failed to generate a response.',
        variant: 'destructive',
      });
      
      setIsTyping(false);
      setIsResponseEnhancing(false);
      setTimeout(() => scrollToBottom(), 50);
    }
  };

  const handleFeedback = async (messageId: string, feedback: 'positive' | 'negative') => {
    // Find the message
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    
    // Update message with feedback
    setMessages(messages.map(m => 
      m.id === messageId 
        ? { ...m, feedback } 
        : m
    ));
    
    try {
      // Submit feedback to API
      await feedbackMutation.mutateAsync({
        responseId: messageId,
        feedback: feedback,
        comments: ''
      });
      
      toast({
        title: 'Feedback Submitted',
        description: `Thank you for your ${feedback} feedback.`,
      });
    } catch (error) {
      console.error('Error submitting feedback:', error);
      
      toast({
        title: 'Error',
        description: 'Failed to submit feedback',
        variant: 'destructive',
      });
    }
  };

  const handleScenarioSelect = (scenarioId: string) => {
    if (!scenariosQuery.data?.length) return;
    
    const scenario = scenariosQuery.data.find(s => s.id === scenarioId) || null;
    setSelectedScenario(scenario);
  };

  const handleTestQuestion = (question: string) => {
    setInputValue(question);
  };

  const clearConversation = () => {
    setMessages([]);
    setSelectedScenario(null);
    toast({
      title: 'Conversation Cleared',
      description: 'The conversation has been reset.',
    });
  };

  return (
    <div className="agent-testing-container">
      <div className="agent-testing-header">
        <div>
          <h1 className="text-3xl font-bold agent-testing-title">Agent Testing Lab</h1>
          <p className="agent-testing-subtitle">Test your AI agent against real knowledge base documents</p>
        </div>
        <Button 
          variant="outline" 
          onClick={clearConversation}
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Reset Conversation
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <Card className="agent-card model-card">
            <CardHeader className="card-header">
              <CardTitle>Model Selection</CardTitle>
              <CardDescription>Choose an AI model to test</CardDescription>
            </CardHeader>
            <CardContent>
              {modelsQuery.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : (
                <>
                  <Select
                    value={selectedModel}
                    onValueChange={setSelectedModel}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {(modelsQuery.data?.length ? modelsQuery.data : defaultModels).map((model) => (
                        <SelectItem key={model.id} value={model.id} className="scenario-select-item">
                          {model.name} ({model.provider})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {selectedModel && (
                    <div className="mt-4 text-sm">
                      {(modelsQuery.data?.length ? modelsQuery.data : defaultModels).find(m => m.id === selectedModel)?.description}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(modelsQuery.data?.length ? modelsQuery.data : defaultModels).find(m => m.id === selectedModel)?.capabilities.map((capability) => (
                          <Badge key={capability} variant="outline">{capability}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
          
          <Card className="agent-card knowledge-card">
            <CardHeader className="card-header">
              <CardTitle>Knowledge Selection</CardTitle>
              <CardDescription>Select documents to include in context</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingDocuments ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : (
                <div>
                  {documents.length > 0 ? (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {documents.map((doc) => (
                        <div key={doc.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`doc-${doc.id}`}
                            checked={selectedDocuments.includes(doc.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedDocuments([...selectedDocuments, doc.id]);
                              } else {
                                setSelectedDocuments(selectedDocuments.filter(id => id !== doc.id));
                              }
                            }}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          <label htmlFor={`doc-${doc.id}`} className="text-sm flex-1 truncate">
                            {doc.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      <p>No documents found</p>
                    </div>
                  )}
                  
                  {selectedDocuments.length > 0 && (
                    <div className="mt-2 flex justify-between items-center">
                      <span className="text-xs text-gray-500">{selectedDocuments.length} document(s) selected</span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setSelectedDocuments([])}
                        className="text-xs h-6 px-2"
                      >
                        Clear
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card className="agent-card scenario-card">
            <CardHeader className="card-header">
              <CardTitle>Test Scenarios</CardTitle>
              <CardDescription>Pre-defined test questions</CardDescription>
            </CardHeader>
            <CardContent>
              {scenariosQuery.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : (
                <>
                  <Select
                    value={selectedScenario?.id || ''}
                    onValueChange={handleScenarioSelect}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a test scenario" />
                    </SelectTrigger>
                    <SelectContent>
                      {scenariosQuery.data?.length ? (
                        // Use dynamically generated scenarios
                        scenariosQuery.data.map((scenario) => (
                          <SelectItem key={scenario.id} value={scenario.id} className="scenario-select-item">
                            {scenario.name}
                          </SelectItem>
                        ))
                      ) : documents.length > 0 ? (
                        // If we have documents but no scenarios yet, show loading
                        <SelectItem value="loading" disabled className="scenario-select-item">
                          Generating scenarios from documents...
                        </SelectItem>
                      ) : (
                        // If no documents and no scenarios, show message
                        <SelectItem value="no-data" disabled className="scenario-select-item">
                          No documents available to generate scenarios
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  
                  {selectedScenario && (
                    <div className="mt-4">
                      <p className="scenario-description">{selectedScenario.description}</p>
                      <div className="space-y-2">
                        {selectedScenario.questions.map((question, index) => (
                          <Button 
                            key={index} 
                            variant="outline" 
                            size="sm" 
                            className="test-question-button w-full justify-start text-left"
                            onClick={() => handleTestQuestion(question)}
                            title={question} // Add title attribute for tooltip on hover
                          >
                            {question}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
          
          <Card className="agent-card settings-card">
            <CardHeader className="card-header">
              <CardTitle>Settings</CardTitle>
              <CardDescription>Configure agent behavior</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="confidenceThreshold">Confidence Threshold</Label>
                    <span className="text-xs text-muted-foreground">{confidenceThreshold}</span>
                  </div>
                  <Input
                    id="confidenceThreshold"
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={confidenceThreshold}
                    onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Responses below this threshold will be flagged for human review.
                  </p>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="humanEscalation">Human Escalation</Label>
                    <p className="text-xs text-muted-foreground">
                      Allow agent to escalate to human support
                    </p>
                  </div>
                  <Switch
                    id="humanEscalation"
                    checked={enableHumanEscalation}
                    onCheckedChange={setEnableHumanEscalation}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="progressiveResponse">Progressive Responses</Label>
                    <p className="text-xs text-muted-foreground">
                      Show quick initial responses, then enhance with documents
                    </p>
                  </div>
                  <Switch
                    id="progressiveResponse"
                    checked={isProgressiveResponse}
                    onCheckedChange={setIsProgressiveResponse}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="md:col-span-2">
          <Card className="h-[calc(100vh-10rem)]">
            <CardHeader className="border-b">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Chat Interface</CardTitle>
                  <CardDescription>Test the agent's responses</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Settings className="h-3 w-3" />
                    {selectedModel}
                  </Badge>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setShowDebugInfo(!showDebugInfo)}
                    title="Toggle debug information"
                  >
                    <Info className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex flex-col h-[calc(100vh-16rem)]">
                {showDebugInfo && (
                  <div className="p-4 border-b bg-muted/50">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Model:</span>
                        <span className="text-muted-foreground">
                          {(modelsQuery.data?.length ? modelsQuery.data : defaultModels)
                            .find(m => m.id === selectedModel)?.name || selectedModel}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Provider:</span>
                        <span className="text-muted-foreground">
                          {(modelsQuery.data?.length ? modelsQuery.data : defaultModels)
                            .find(m => m.id === selectedModel)?.provider || 'Unknown'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Context Window:</span>
                        <span className="text-muted-foreground">
                          {(modelsQuery.data?.length ? modelsQuery.data : defaultModels)
                            .find(m => m.id === selectedModel)?.contextWindowSize || 'Unknown'} tokens
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Knowledge Cutoff:</span>
                        <span className="text-muted-foreground">
                          {(modelsQuery.data?.length ? modelsQuery.data : defaultModels)
                            .find(m => m.id === selectedModel)?.knowledgeCutoff || 'Unknown'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex-1 p-4 overflow-y-auto">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4 text-gray-500">
                      <Bot className="h-12 w-12 mb-4 text-gray-400" />
                      <h3 className="text-lg font-medium">Start Testing the Agent</h3>
                      <p className="max-w-md mt-2">
                        Send a message to see how the agent responds. You can use the test scenarios or ask your own questions.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <div 
                          key={`msg-${message.id}`} 
                          className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} ${
                            message.isStreaming ? 'hidden' : ''
                          }`}
                        >
                          <div 
                            className={`message-bubble ${
                              message.sender === 'user' 
                                ? 'user-message' 
                                : 'agent-message'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              {message.sender === 'user' ? (
                                <User className="h-4 w-4" />
                              ) : (
                                <Bot className="h-4 w-4" />
                              )}
                              <span className="text-xs opacity-70">
                                {message.timestamp.toLocaleTimeString()}
                              </span>
                              {message.progressiveStage === 1 && (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 h-5 px-1 text-xs flex items-center gap-1">
                                  <Info className="h-3 w-3" />
                                  Initial Response
                                </Badge>
                              )}
                              {message.progressiveStage === 2 && selectedDocuments.length > 0 && (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 h-5 px-1 text-xs flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3" />
                                  Document-Enhanced
                                </Badge>
                              )}
                              {message.sender === 'agent' && message.isStreaming && (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 h-5 px-1 text-xs flex items-center gap-1">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Thinking...
                                </Badge>
                              )}
                              {message.needsHumanReview && (
                                <Badge variant="destructive" className="h-5 px-1 text-xs flex items-center gap-1" key={`review-${message.id}`}>
                                  <AlertTriangle className="h-3 w-3" />
                                  Needs Review
                                </Badge>
                              )}
                              {message.sender === 'agent' && isResponseEnhancing && message.id === messages[messages.length - 1].id && (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 h-5 px-1 text-xs flex items-center gap-1" key={`enhancing-${message.id}`}>
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Enhancing with documents...
                                </Badge>
                              )}
                            </div>
                            <div className="message-content">
                              {message.isStreaming ? (
                                <TypewriterText 
                                  text={message.streamedContent || ''}
                                  isStreaming={true}
                                  speed={5}
                                />
                              ) : (
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {message.content}
                                </ReactMarkdown>
                              )}
                            </div>
                            
                            {message.sources && message.sources.length > 0 && (
                              <div className="mt-2 text-xs text-gray-500">
                                <div className="font-medium mb-1">Sources:</div>
                                {message.sources.map((source, index) => (
                                  <div key={index} className="flex items-center gap-1 ml-2">
                                    <FileText className="h-3 w-3" />
                                    <span>{source.title} - {source.url}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {showDebugInfo && message.sender === 'agent' && (
                              <div className="mt-2 text-xs text-gray-500 border-t pt-2">
                                <div className="font-medium">Debug Info:</div>
                                <div className="mt-1 space-y-1">
                                  <div>Model: {selectedModel}</div>
                                  <div>Confidence Threshold: {confidenceThreshold}</div>
                                  <div>Human Escalation: {enableHumanEscalation ? 'Enabled' : 'Disabled'}</div>
                                  {responseTime && <div>Response time: {responseTime/1000}s</div>}
                                  {selectedDocuments.length > 0 && (
                                    <div>Context Documents: {selectedDocuments.length}</div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      
                      {/* Show a loading indicator when an AI response is being generated */}
                      {isTyping && (
                        <div className="flex justify-start" key={`loading-${generateUniqueId()}`}>
                          <div className="message-bubble agent-message p-3">
                            <div className="flex items-center gap-2">
                              <Bot className="h-4 w-4" />
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span className="text-sm">
                                {isResponseEnhancing ? (
                                  <>Enhancing response with documents... ({Math.floor((Date.now() - responseStartTime)/1000)}s)</>
                                ) : responseStartTime ? (
                                  <>Generating initial response... ({Math.floor((Date.now() - responseStartTime)/1000)}s)</>
                                ) : (
                                  <>Generating response...</>
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>
                
                <div className="p-4 border-t">
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendMessage();
                    }}
                    className="flex items-end gap-2"
                  >
                    <Textarea
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="Type your message..."
                      className="resize-none min-h-[60px]"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                    <Button 
                      type="submit" 
                      size="icon" 
                      className="flex-shrink-0"
                      disabled={!inputValue.trim() || isTyping}
                    >
                      <Send className="h-5 w-5" />
                    </Button>
                  </form>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AgentTesting;
