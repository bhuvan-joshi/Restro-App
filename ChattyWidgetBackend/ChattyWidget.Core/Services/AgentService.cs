using ChattyWidget.Models.Agent;
using ChattyWidget.Core.Interfaces;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace ChattyWidget.Core.Services
{
    public class AgentService : IAgentService
    {
        private readonly IDocumentService _documentService;
        private readonly ILlmService _llmService;
        private readonly IEmbeddingService _embeddingService;
        private readonly ILogger<AgentService> _logger;
        private readonly Dictionary<string, AgentModel> _availableModels;
        private readonly List<TestScenario> _testScenarios;

        public AgentService(
            IDocumentService documentService, 
            ILlmService llmService, 
            IEmbeddingService embeddingService,
            ILogger<AgentService> logger)
        {
            _documentService = documentService;
            _llmService = llmService;
            _embeddingService = embeddingService;
            _logger = logger;
            
            // Initialize available models
            _availableModels = InitializeModels();
            
            // Initialize test scenarios
            _testScenarios = InitializeTestScenarios();
        }

        public async Task<AgentQueryResponse> ProcessQueryAsync(AgentQueryRequest request)
        {
            _logger.LogInformation($"Processing query: {request.Query} with model: {request.ModelId}");
            
            try
            {
                // Validate the model
                if (!_availableModels.ContainsKey(request.ModelId))
                {
                    throw new ArgumentException($"Invalid model ID: {request.ModelId}");
                }

                // Retrieve relevant documents based on the query
                var relevantDocuments = await RetrieveRelevantDocumentsAsync(request.Query, request.DocumentIds);
                
                // Generate a response based on the query and relevant documents
                var response = await GenerateResponseAsync(request, relevantDocuments);
                
                // Check if the response confidence is below the threshold and escalation is enabled
                if (response.Confidence < request.ConfidenceThreshold && request.EnableHumanEscalation)
                {
                    response.NeedsHumanReview = true;
                }
                
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error processing query: {request.Query}");
                throw;
            }
        }

        public List<AgentModel> GetAvailableModels()
        {
            try
            {
                // Get the base list of models from our static initialization
                var models = new List<AgentModel>(_availableModels.Values);

                // Get dynamically available Ollama models (synchronously)
                var ollamaModels = _llmService.GetAvailableOllamaModelsAsync().GetAwaiter().GetResult();
                
                foreach (var modelId in ollamaModels)
                {
                    // Skip if we already have this model in our list
                    if (_availableModels.ContainsKey(modelId))
                    {
                        continue;
                    }
                    
                    // Create model details based on the model ID
                    var modelName = modelId.Replace(":latest", "").Replace(":", " ");
                    
                    // Try to extract provider and version info from model ID
                    string provider = "Ollama";
                    string description = "Local LLM model";
                    int contextSize = 8192; // Default context size
                    
                    // Create a new model entry
                    var model = new AgentModel
                    {
                        Id = modelId,
                        Name = char.ToUpper(modelName[0]) + modelName.Substring(1), // Capitalize first letter
                        Provider = provider,
                        Description = description,
                        ContextWindowSize = contextSize,
                        KnowledgeCutoff = "Varies",
                        Capabilities = new List<string> { "Text Generation", "Q&A" },
                        SubscriptionLevel = "free"
                    };
                    
                    models.Add(model);
                    
                    // Also add to our in-memory dictionary for future reference
                    _availableModels[modelId] = model;
                }
                
                return models;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting available models");
                return _availableModels.Values.ToList(); // Fall back to static list
            }
        }

        public async Task RecordFeedbackAsync(AgentFeedbackRequest request)
        {
            _logger.LogInformation($"Recording feedback for response: {request.ResponseId}, feedback: {request.Feedback}");
            
            try
            {
                // In a real implementation, this would store the feedback in a database
                // For now, we'll just log it
                _logger.LogInformation($"Feedback recorded: {request.Feedback}, Comments: {request.Comments}");
                
                await Task.CompletedTask; // Placeholder for async implementation
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error recording feedback for response: {request.ResponseId}");
                throw;
            }
        }

        public List<TestScenario> GetTestScenarios()
        {
            return _testScenarios;
        }

        // Add new streaming method
        public async Task StreamQueryAsync(
            AgentQueryRequest request,
            Func<string, Task> onChunkReceived,
            Func<Exception, Task> onError,
            Func<AgentQueryResponse, Task> onComplete)
        {
            _logger.LogInformation($"Processing streaming query: {request.Query} with model: {request.ModelId}");
            
            try
            {
                // Validate the model
                if (!_availableModels.ContainsKey(request.ModelId))
                {
                    throw new ArgumentException($"Invalid model ID: {request.ModelId}");
                }

                // Retrieve relevant documents based on the query
                var relevantDocuments = await RetrieveRelevantDocumentsAsync(request.Query, request.DocumentIds);
                
                // Prepare response object
                var response = new AgentQueryResponse
                {
                    ResponseId = Guid.NewGuid().ToString(),
                    Sources = relevantDocuments,
                    Timestamp = DateTime.UtcNow
                };
                
                // Prepare document contents for the LLM
                var documentContents = new List<string>();
                var documentTitles = new List<string>();
                
                // If specific document IDs were requested, prioritize those
                if (request.DocumentIds != null && request.DocumentIds.Count > 0)
                {
                    foreach (var docIdStr in request.DocumentIds)
                    {
                        try
                        {
                            if (Guid.TryParse(docIdStr, out Guid docId))
                            {
                                var document = await _documentService.GetDocumentByIdAsync(docId);
                                if (document != null && !string.IsNullOrEmpty(document.Content))
                                {
                                    documentContents.Add(document.Content);
                                    documentTitles.Add(document.Name);
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, $"Error retrieving document {docIdStr}");
                        }
                    }
                }
                
                // Add documents found by vector search
                foreach (var docRef in relevantDocuments)
                {
                    try
                    {
                        if (Guid.TryParse(docRef.DocumentId, out Guid docId))
                        {
                            var document = await _documentService.GetDocumentByIdAsync(docId);
                            if (document != null && !string.IsNullOrEmpty(document.Content))
                            {
                                // Only add if not already added by document ID
                                if (!documentContents.Contains(document.Content))
                                {
                                    documentContents.Add(document.Content);
                                    documentTitles.Add(document.Name);
                                }
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error processing document reference");
                    }
                }
                
                if (documentContents.Count > 0)
                {
                    _logger.LogInformation($"Using LLM model {request.ModelId} to generate streaming response with {documentContents.Count} documents");
                    
                    // Get the subscription level from the model
                    string subscriptionLevel = "free";
                    if (_availableModels.TryGetValue(request.ModelId, out var model))
                    {
                        subscriptionLevel = model.SubscriptionLevel;
                    }
                    
                    // Check if the model is available
                    if (!_llmService.IsModelAvailable(request.ModelId, subscriptionLevel))
                    {
                        _logger.LogWarning($"Model {request.ModelId} is not available for subscription level {subscriptionLevel}");
                        request.ModelId = GetDefaultModelForSubscription(subscriptionLevel);
                        _logger.LogInformation($"Falling back to model {request.ModelId}");
                    }
                    
                    // For larger models, limit content
                    bool isLargeModel = request.ModelId.Contains("deepseek") || request.ModelId.Contains("llama3");
                    if (isLargeModel && documentContents.Count > 3)
                    {
                        _logger.LogInformation($"Limiting document count for large model {request.ModelId}");
                        documentContents = documentContents.Take(3).ToList();
                        documentTitles = documentTitles.Take(3).ToList();
                    }
                    
                    string responseText = "";
                    double confidence = 0.7; // Default confidence
                    
                    // Create a wrapper for the chunk processor
                    Func<string, Task> chunkProcessor = async (chunk) =>
                    {
                        responseText += chunk;
                        await onChunkReceived(chunk);
                    };
                    
                    // Create a wrapper for completion
                    Func<Task> completionHandler = async () =>
                    {
                        // Create the completed response
                        response.Response = responseText;
                        response.Confidence = confidence;
                        
                        // Check confidence threshold
                        if (response.Confidence < request.ConfidenceThreshold && request.EnableHumanEscalation)
                        {
                            response.NeedsHumanReview = true;
                        }
                        
                        await onComplete(response);
                    };
                    
                    // Stream the response
                    await _llmService.StreamResponseAsync(
                        request.Query,
                        documentContents,
                        documentTitles,
                        request.ModelId,
                        chunkProcessor,
                        onError,
                        completionHandler
                    );
                }
                else
                {
                    _logger.LogWarning("No relevant documents found for query");
                    response.Response = "I'm sorry, but I couldn't find any relevant documents to answer your question.";
                    response.Confidence = 0.0;
                    response.NeedsHumanReview = request.EnableHumanEscalation;
                    
                    await onComplete(response);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error processing streaming query: {request.Query}");
                await onError(ex);
            }
        }

        #region Private Methods

        private async Task<List<DocumentReference>> RetrieveRelevantDocumentsAsync(string query, List<string> documentIds)
        {
            var relevantDocuments = new List<DocumentReference>();
            
            try
            {
                // If specific documents are provided, use only those
                if (documentIds != null && documentIds.Count > 0)
                {
                    _logger.LogInformation($"Using {documentIds.Count} selected documents");
                    
                    foreach (var docId in documentIds)
                    {
                        // Retrieve the actual document
                        var document = await _documentService.GetDocumentAsync(docId);
                        if (document != null)
                        {
                            // Add with default relevance
                            relevantDocuments.Add(new DocumentReference
                            {
                                DocumentId = docId,
                                Title = document.Name,
                                Url = $"/documents/{docId}",
                                Relevance = 0.9 // High relevance since explicitly selected
                            });
                        }
                    }
                }
                else
                {
                    // Use vector search to find relevant documents
                    _logger.LogInformation("Performing vector similarity search");
                    var searchResults = await _embeddingService.SearchSimilarDocumentsAsync(query, limit: 5);
                    
                    var addedDocIds = new HashSet<Guid>(); // Track added document IDs
                    
                    foreach (var result in searchResults)
                    {
                        // Only add each document once (take the highest similarity chunk)
                        if (!addedDocIds.Contains(result.DocumentId))
                        {
                            relevantDocuments.Add(new DocumentReference
                            {
                                DocumentId = result.DocumentId.ToString(),
                                Title = result.DocumentName,
                                Url = $"/documents/{result.DocumentId}",
                                Relevance = result.Similarity
                            });
                            
                            addedDocIds.Add(result.DocumentId);
                        }
                    }
                    
                    _logger.LogInformation($"Vector search found {relevantDocuments.Count} documents");
                    
                    // If vector search didn't find any documents, fall back to legacy search
                    if (relevantDocuments.Count == 0)
                    {
                        _logger.LogInformation("No documents found with vector search, falling back to legacy search");
                        
                        // Perform a search across all documents using legacy method
                        var searchResults2 = await _documentService.SearchDocumentsAsync(query);
                    
                    // Convert search results to document references
                        foreach (var result in searchResults2.Take(3)) // Limit to top 3 results
                    {
                        // Calculate a simple relevance score based on term frequency
                        double relevance = 0.5; // Base relevance
                        if (!string.IsNullOrEmpty(result.Content) && !string.IsNullOrEmpty(query))
                        {
                            // Count occurrences of query terms in the document
                            var queryTerms = query.ToLower().Split(' ', StringSplitOptions.RemoveEmptyEntries);
                            var documentText = result.Content.ToLower();
                            
                            int matchCount = 0;
                            foreach (var term in queryTerms)
                            {
                                if (documentText.Contains(term))
                                {
                                    matchCount++;
                                }
                            }
                            
                            // Calculate relevance based on percentage of matching terms
                            if (queryTerms.Length > 0)
                            {
                                relevance = 0.5 + (0.5 * matchCount / queryTerms.Length);
                            }
                        }
                        
                        relevantDocuments.Add(new DocumentReference
                        {
                            DocumentId = result.Id.ToString(),
                            Title = result.Name,
                            Url = $"/documents/{result.Id}",
                            Relevance = relevance
                        });
                        }
                    }
                }
                
                // Sort by relevance score in descending order
                return relevantDocuments.OrderByDescending(d => d.Relevance).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving relevant documents");
                return new List<DocumentReference>();
            }
        }

        private async Task<AgentQueryResponse> GenerateResponseAsync(AgentQueryRequest request, List<DocumentReference> relevantDocuments)
        {
            var response = new AgentQueryResponse
            {
                ResponseId = Guid.NewGuid().ToString(),
                Sources = relevantDocuments,
                Timestamp = DateTime.UtcNow
            };
            
            try
            {
                var documentContents = new List<string>();
                var documentTitles = new List<string>();
                
                _logger.LogInformation($"Processing {relevantDocuments.Count} relevant documents for response generation");
                
                // If specific document IDs were requested, prioritize those
                if (request.DocumentIds != null && request.DocumentIds.Count > 0)
                {
                    _logger.LogInformation($"User specified {request.DocumentIds.Count} documents to use as context");
                    
                    // Get requested documents first
                    foreach (var docIdStr in request.DocumentIds)
                    {
                        try
                        {
                            if (Guid.TryParse(docIdStr, out Guid docId))
                            {
                                var document = await _documentService.GetDocumentByIdAsync(docId);
                                if (document != null && !string.IsNullOrEmpty(document.Content))
                                {
                                    documentContents.Add(document.Content);
                                    documentTitles.Add(document.Name);
                                    _logger.LogInformation($"Added user-selected document: {document.Name} ({document.Content.Length} chars)");
                                }
                                else
                                {
                                    _logger.LogWarning($"Document with ID {docId} was not found or has no content");
                                }
                            }
                            else
                            {
                                _logger.LogWarning($"Invalid document ID format: {docIdStr}");
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, $"Error retrieving document {docIdStr}");
                        }
                    }
                }
                
                // Then add documents found by vector search
                foreach (var docRef in relevantDocuments)
                {
                    try
                    {
                        if (string.IsNullOrEmpty(docRef.DocumentId))
                        {
                            _logger.LogWarning("Document reference has null or empty DocumentId");
                            continue;
                        }
                        
                        if (Guid.TryParse(docRef.DocumentId, out Guid docId))
                        {
                            // Skip if we already added this document from user selection
                            if (documentTitles.Any(title => title == docRef.Title))
                            {
                                continue;
                            }
                            
                            try
                            {
                                var document = await _documentService.GetDocumentByIdAsync(docId);
                                if (document != null && !string.IsNullOrEmpty(document.Content))
                                {
                                    documentContents.Add(document.Content);
                                    documentTitles.Add(document.Name);
                                    _logger.LogInformation($"Added search result document: {document.Name} (similarity: {docRef.Relevance:F2})");
                                }
                                else
                                {
                                    _logger.LogWarning($"Search result document with ID {docId} was not found or has no content");
                                }
                            }
                            catch (Exception ex)
                            {
                                _logger.LogError(ex, $"Error retrieving search result document {docId}");
                            }
                        }
                        else
                        {
                            _logger.LogWarning($"Invalid document ID format in search results: {docRef.DocumentId}");
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error processing document reference");
                    }
                }
                
                if (documentContents.Count > 0)
                {
                    _logger.LogInformation($"Using LLM model {request.ModelId} to generate response with {documentContents.Count} documents");
                    
                    // Get the subscription level from the model
                    string subscriptionLevel = "free";
                    if (_availableModels.TryGetValue(request.ModelId, out var model))
                    {
                        subscriptionLevel = model.SubscriptionLevel;
                    }
                    
                    // Check if the model is available
                    if (!_llmService.IsModelAvailable(request.ModelId, subscriptionLevel))
                    {
                        _logger.LogWarning($"Model {request.ModelId} is not available for subscription level {subscriptionLevel}");
                        request.ModelId = GetDefaultModelForSubscription(subscriptionLevel);
                        _logger.LogInformation($"Falling back to model {request.ModelId}");
                    }
                    
                    // For DeepSeek and other larger models, be more conservative with context size
                    if (request.ModelId.Contains("deepseek"))
                    {
                        _logger.LogInformation("Using DeepSeek model - optimizing document context for better performance");
                        
                        // Limit the number of documents and their size for DeepSeek
                        const int maxDocuments = 3;
                        const int maxDocumentSize = 1500;
                        
                        if (documentContents.Count > maxDocuments)
                        {
                            _logger.LogInformation($"Limiting from {documentContents.Count} to {maxDocuments} documents for DeepSeek model");
                            var trimmedDocContents = new List<string>();
                            var trimmedDocTitles = new List<string>();
                            
                            // Keep only the most relevant documents (which should be at the beginning of the list)
                            for (int i = 0; i < Math.Min(maxDocuments, documentContents.Count); i++)
                            {
                                var content = documentContents[i];
                                
                                // Trim document content if too large
                                if (content.Length > maxDocumentSize)
                                {
                                    content = content.Substring(0, maxDocumentSize) + "...";
                                    _logger.LogInformation($"Trimmed document {documentTitles[i]} from {documentContents[i].Length} to {maxDocumentSize} chars");
                                }
                                
                                trimmedDocContents.Add(content);
                                trimmedDocTitles.Add(documentTitles[i]);
                            }
                            
                            documentContents = trimmedDocContents;
                            documentTitles = trimmedDocTitles;
                        }
                    }
                    
                    // Call the LLM service with text content
                    var llmResponse = await _llmService.GenerateResponseAsync(
                        request.Query, 
                        documentContents, 
                        documentTitles, 
                        request.ModelId);
                    
                    response.Response = llmResponse.Content;
                    response.Confidence = llmResponse.Confidence;
                    response.ModelId = request.ModelId;
                    
                    _logger.LogInformation($"LLM response generated with {llmResponse.Confidence:P} confidence");
                }
                else
                {
                    response.Response = "I couldn't find any relevant information in the knowledge base to answer your question. " +
                                      "Please try rephrasing your query or providing more context.";
                    response.Confidence = 0.3;
                    response.ModelId = request.ModelId;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error generating response with LLM: {ex.Message}");
                response.Response = "I apologize, but I'm currently experiencing technical difficulties in accessing the knowledge base. " +
                                  "Please try again later or contact support if the problem persists.";
                response.Confidence = 0.1;
                response.ModelId = request.ModelId;
            }
            
            return response;
        }
        
        /// <summary>
        /// Get the default model name for a given subscription level
        /// </summary>
        private string GetDefaultModelForSubscription(string subscriptionLevel)
        {
            // Simple logic to choose a default model based on subscription
            switch (subscriptionLevel?.ToLower())
            {
                case "premium":
                    return "mistral:latest";
                case "basic":
                case "free":
                default:
                    return "llama3.2:latest";
            }
        }
        
        private List<string> SplitIntoSentences(string text)
        {
            // Simple sentence splitter - in a real implementation, use a more sophisticated NLP approach
            var sentenceEnders = new[] { '.', '!', '?' };
            var sentences = new List<string>();
            var currentSentence = "";
            
            foreach (var c in text)
            {
                currentSentence += c;
                
                if (sentenceEnders.Contains(c))
                {
                    sentences.Add(currentSentence.Trim());
                    currentSentence = "";
                }
            }
            
            if (!string.IsNullOrWhiteSpace(currentSentence))
            {
                sentences.Add(currentSentence.Trim());
            }
            
            return sentences;
        }

        private Dictionary<string, AgentModel> InitializeModels()
        {
            return new Dictionary<string, AgentModel>
            {
                {
                    "llama3.2:latest", new AgentModel
                    {
                        Id = "llama3.2:latest",
                        Name = "Llama 3.2 (3B)",
                        Provider = "Meta",
                        Description = "Open-source model suitable for general tasks",
                        ContextWindowSize = 8192,
                        KnowledgeCutoff = "2023-12",
                        Capabilities = new List<string> { "Text Generation", "Q&A", "Summarization" },
                        SubscriptionLevel = "free"
                    }
                },
                {
                    "mistral:latest", new AgentModel
                    {
                        Id = "mistral:latest",
                        Name = "Mistral 7B",
                        Provider = "Mistral AI",
                        Description = "Open-source model with strong reasoning capabilities",
                        ContextWindowSize = 8192,
                        KnowledgeCutoff = "2023-12",
                        Capabilities = new List<string> { "Text Generation", "Q&A", "Reasoning" },
                        SubscriptionLevel = "free"
                    }
                },
                {
                    "deepseek-r1:14b", new AgentModel
                    {
                        Id = "deepseek-r1:14b",
                        Name = "DeepSeek 14B",
                        Provider = "DeepSeek AI",
                        Description = "Advanced model with strong performance on knowledge-intensive tasks",
                        ContextWindowSize = 8192,
                        KnowledgeCutoff = "2023-12",
                        Capabilities = new List<string> { "Text Generation", "Q&A", "Knowledge Retrieval", "Reasoning" },
                        SubscriptionLevel = "free"
                    }
                },
                {
                    "deepseek-chat", new AgentModel
                    {
                        Id = "deepseek-chat",
                        Name = "DeepSeek Chat (Cloud)",
                        Provider = "DeepSeek AI",
                        Description = "Cloud-based model with excellent document processing capabilities",
                        ContextWindowSize = 32768,
                        KnowledgeCutoff = "2023-12",
                        Capabilities = new List<string> { "Text Generation", "Q&A", "Document Analysis", "Reasoning" },
                        SubscriptionLevel = "basic"
                    }
                },
                {
                    "gpt-4o-mini", new AgentModel
                    {
                        Id = "gpt-4o-mini",
                        Name = "GPT-4o Mini",
                        Provider = "OpenAI",
                        Description = "Smaller version of GPT-4o with good performance",
                        ContextWindowSize = 16384,
                        KnowledgeCutoff = "2023-10",
                        Capabilities = new List<string> { "Text Generation", "Q&A", "Summarization", "Code Generation" },
                        SubscriptionLevel = "basic"
                    }
                },
                {
                    "gpt-4o", new AgentModel
                    {
                        Id = "gpt-4o",
                        Name = "GPT-4o",
                        Provider = "OpenAI",
                        Description = "Latest multimodal model with excellent performance",
                        ContextWindowSize = 32768,
                        KnowledgeCutoff = "2023-12",
                        Capabilities = new List<string> { "Text Generation", "Q&A", "Summarization", "Code Generation", "Image Understanding" },
                        SubscriptionLevel = "premium"
                    }
                },
                {
                    "perplexity-online", new AgentModel
                    {
                        Id = "perplexity-online",
                        Name = "Perplexity Online",
                        Provider = "Perplexity",
                        Description = "Online model with real-time web search capabilities",
                        ContextWindowSize = 16384,
                        KnowledgeCutoff = "Current",
                        Capabilities = new List<string> { "Text Generation", "Q&A", "Web Search", "Real-time Information" },
                        SubscriptionLevel = "premium"
                    }
                }
            };
        }

        private List<TestScenario> InitializeTestScenarios()
        {
            return new List<TestScenario>
            {
                new TestScenario
                {
                    Id = "1",
                    Name = "Product Pricing Questions",
                    Description = "Test how the agent responds to questions about pricing and plans",
                    Questions = new List<string>
                    {
                        "How much does the premium plan cost?",
                        "What's included in the basic plan?",
                        "Is there a free trial available?",
                        "Do you offer discounts for annual subscriptions?"
                    }
                },
                new TestScenario
                {
                    Id = "2",
                    Name = "Technical Support Queries",
                    Description = "Test how the agent handles technical support questions",
                    Questions = new List<string>
                    {
                        "How do I reset my password?",
                        "I'm having trouble connecting to the API",
                        "Is there documentation for the REST API?",
                        "What are the system requirements?"
                    }
                },
                new TestScenario
                {
                    Id = "3",
                    Name = "Out of Scope Questions",
                    Description = "Test how the agent handles questions outside its knowledge domain",
                    Questions = new List<string>
                    {
                        "What's the weather like today?",
                        "Can you book a flight for me?",
                        "What's your opinion on politics?",
                        "Write me a poem about artificial intelligence"
                    }
                }
            };
        }

        #endregion
    }
}
