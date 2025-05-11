using ChattyWidget.Core.DTOs;
using ChattyWidget.Core.Interfaces;
using ChattyWidget.Models.Agent;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.IO;

namespace ChattyWidget.Core.Services
{
    public class OllamaLlmService : ILlmService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly LlmProviderConfig _config;
        private readonly ILogger<OllamaLlmService> _logger;
        private readonly Dictionary<string, string> _modelProviderMap;
        private readonly Dictionary<string, string> _modelSubscriptionLevelMap;

        public OllamaLlmService(
            IHttpClientFactory httpClientFactory,
            IOptions<LlmProviderConfig> config,
            ILogger<OllamaLlmService> logger)
        {
            _httpClientFactory = httpClientFactory;
            _config = config.Value;
            _logger = logger;
            
            // Initialize model-to-provider and model-to-subscription-level mappings
            _modelProviderMap = new Dictionary<string, string>
            {
                { "llama3.2:latest", "Ollama" },
                { "mistral:latest", "Ollama" },
                { "deepseek-r1:14b", "Ollama" }
            };
            
            _modelSubscriptionLevelMap = new Dictionary<string, string>
            {
                { "llama3.2:latest", "free" },
                { "mistral:latest", "free" },
                { "deepseek-r1:14b", "free" }
            };
        }

        public async Task<LlmResponse> GenerateResponseAsync(
            string query, 
            List<string> documentContents, 
            List<string> documentTitles, 
            string modelId)
        {
            try
            {
                // Validate model ID and get provider
                if (!_modelProviderMap.TryGetValue(modelId, out var provider) || provider != "Ollama")
                {
                    _logger.LogError($"Model {modelId} is not supported by Ollama provider");
                    throw new ArgumentException($"Model {modelId} is not supported by Ollama provider");
                }
                
                // Format documents into context for the prompt
                string context = FormatDocumentsAsContext(documentContents, documentTitles);
                
                // Create a prompt with the context and query
                string systemPrompt = GetSystemPrompt();
                string fullPrompt = $"{systemPrompt}\n\nContext information is below.\n\n{context}\n\nGiven the context information and not prior knowledge, answer the question: {query}";
                
                // Create request for Ollama API
                var requestBody = new
                {
                    model = modelId,
                    prompt = fullPrompt,
                    stream = false,
                    options = new
                    {
                        temperature = 0.3,
                        num_predict = 500
                    }
                };
                
                // Serialize the request
                string requestJson = JsonSerializer.Serialize(requestBody);
                _logger.LogInformation($"Sending request to Ollama API with model: {modelId}");
                
                // Create HTTP client and request
                var client = _httpClientFactory.CreateClient();
                var endpoint = string.IsNullOrEmpty(_config.Ollama.BaseUrl) 
                    ? "http://localhost:11434" 
                    : _config.Ollama.BaseUrl;
                
                var request = new HttpRequestMessage(HttpMethod.Post, $"{endpoint}/api/generate")
                {
                    Content = new StringContent(requestJson, Encoding.UTF8, "application/json")
                };
                
                // Send request and get response
                HttpResponseMessage response;
                try 
                {
                    // Increase timeout for larger models like DeepSeek
                    client.Timeout = TimeSpan.FromMinutes(5); // Increase from default 100 seconds to 5 minutes
                    _logger.LogInformation($"Sending request to Ollama API for model {modelId} with 5-minute timeout");
                    response = await client.SendAsync(request);
                }
                catch (HttpRequestException ex)
                {
                    _logger.LogError(ex, $"Network error communicating with Ollama API: {ex.Message}");
                    throw new Exception($"Failed to connect to Ollama API: {ex.Message}");
                }
                
                // Process response
                if (response.IsSuccessStatusCode)
                {
                    try
                    {
                        var responseContent = await response.Content.ReadAsStringAsync();
                        using var jsonDocument = JsonDocument.Parse(responseContent);
                        
                        // Extract content from response
                        if (jsonDocument.RootElement.TryGetProperty("response", out var responseElement))
                        {
                            var content = responseElement.GetString();
                            
                            // Calculate a confidence score based on temperature and other factors
                            // For now, use a fixed value, but this could be more sophisticated
                            double confidence = 0.75; // Lower confidence for open-source models
                            
                            // Create response object
                            return new LlmResponse
                            {
                                Content = content,
                                ModelId = modelId,
                                Confidence = confidence,
                                Citations = documentTitles,
                                Metadata = new Dictionary<string, object>
                                {
                                    { "provider", "Ollama" },
                                    { "evalDuration", jsonDocument.RootElement.TryGetProperty("eval_duration", out var evalDuration) 
                                        ? evalDuration.GetInt64() 
                                        : 0 }
                                }
                            };
                        }
                        else
                        {
                            _logger.LogError($"Unexpected Ollama API response format: {responseContent}");
                            throw new Exception("Unexpected response format from Ollama API");
                        }
                    }
                    catch (JsonException ex)
                    {
                        _logger.LogError(ex, "Error parsing Ollama API response");
                        throw new Exception($"Error parsing Ollama API response: {ex.Message}");
                    }
                }
                else
                {
                    // Log error and throw exception
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogError($"Error from Ollama API: {response.StatusCode} - {errorContent}");
                    
                    // Try to extract error message from JSON response
                    try
                    {
                        using var jsonDocument = JsonDocument.Parse(errorContent);
                        if (jsonDocument.RootElement.TryGetProperty("error", out var errorElement))
                        {
                            var errorMessage = errorElement.GetString();
                            throw new Exception($"Error from Ollama API: {errorMessage}");
                        }
                    }
                    catch (JsonException)
                    {
                        // If JSON parsing fails, use the raw content
                    }
                    
                    throw new Exception($"Error from Ollama API: {response.StatusCode}");
                }
            }
            catch (Exception ex) when (!(ex is ArgumentException)) // Don't catch ArgumentException
            {
                _logger.LogError(ex, $"Error generating response with Ollama model {modelId}");
                throw;
            }
        }
        
        public bool IsModelAvailable(string modelId, string subscriptionLevel)
        {
            // Check if model exists
            if (!_modelProviderMap.TryGetValue(modelId, out var provider))
            {
                return false;
            }
            
            // Check if provider is Ollama
            if (provider != "Ollama")
            {
                return false;
            }
            
            // Check if API endpoint is configured
            if (string.IsNullOrEmpty(_config.Ollama.BaseUrl))
            {
                // Default to localhost if not configured
                _config.Ollama.BaseUrl = "http://localhost:11434";
            }
            
            // All subscription levels have access to free Ollama models
            return true;
        }
        
        public string GetProviderForModel(string modelId)
        {
            return _modelProviderMap.TryGetValue(modelId, out var provider) ? provider : null;
        }
        
        public async Task<List<string>> GetAvailableOllamaModelsAsync()
        {
            try
            {
                // Create HTTP client and request
                var client = _httpClientFactory.CreateClient();
                var endpoint = string.IsNullOrEmpty(_config.Ollama.BaseUrl) 
                    ? "http://localhost:11434" 
                    : _config.Ollama.BaseUrl;
                
                var response = await client.GetAsync($"{endpoint}/api/tags");
                
                if (response.IsSuccessStatusCode)
                {
                    var responseContent = await response.Content.ReadAsStringAsync();
                    using var jsonDocument = JsonDocument.Parse(responseContent);
                    
                    var modelsArray = jsonDocument.RootElement.GetProperty("models");
                    var models = new List<string>();
                    
                    foreach (var model in modelsArray.EnumerateArray())
                    {
                        if (model.TryGetProperty("name", out var modelName))
                        {
                            models.Add(modelName.GetString());
                            
                            // Register the model in our mapping dictionaries if not already there
                            var modelId = modelName.GetString();
                            if (!string.IsNullOrEmpty(modelId) && !_modelProviderMap.ContainsKey(modelId))
                            {
                                _modelProviderMap[modelId] = "Ollama";
                                _modelSubscriptionLevelMap[modelId] = "free";
                                _logger.LogInformation($"Discovered and registered Ollama model: {modelId}");
                            }
                        }
                    }
                    
                    return models;
                }
                else
                {
                    _logger.LogError($"Error getting available models from Ollama: {response.StatusCode}");
                    return new List<string>();
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error discovering Ollama models");
                return new List<string>();
            }
        }
        
        // Add new streaming method
        public async Task StreamResponseAsync(
            string query,
            List<string> documentContents,
            List<string> documentTitles,
            string modelId,
            Func<string, Task> onChunkReceived,
            Func<Exception, Task> onError,
            Func<Task> onComplete)
        {
            try
            {
                // Validate model ID and get provider
                if (!_modelProviderMap.TryGetValue(modelId, out var provider) || provider != "Ollama")
                {
                    _logger.LogError($"Model {modelId} is not supported by Ollama provider");
                    throw new ArgumentException($"Model {modelId} is not supported by Ollama provider");
                }
                
                // Format documents into context for the prompt
                string context = FormatDocumentsAsContext(documentContents, documentTitles);
                
                // Create a prompt with the context and query
                string systemPrompt = GetSystemPrompt();
                string fullPrompt = $"{systemPrompt}\n\nContext information is below.\n\n{context}\n\nGiven the context information and not prior knowledge, answer the question: {query}";
                
                // Create request for Ollama API with streaming enabled
                var requestBody = new
                {
                    model = modelId,
                    prompt = fullPrompt,
                    stream = true, // Enable streaming
                    options = new
                    {
                        temperature = 0.3,
                        num_predict = 500
                    }
                };
                
                // Serialize the request
                string requestJson = JsonSerializer.Serialize(requestBody);
                _logger.LogInformation($"Sending streaming request to Ollama API with model: {modelId}");
                
                // Create HTTP client and request
                var client = _httpClientFactory.CreateClient();
                var endpoint = string.IsNullOrEmpty(_config.Ollama.BaseUrl) 
                    ? "http://localhost:11434" 
                    : _config.Ollama.BaseUrl;
                
                var request = new HttpRequestMessage(HttpMethod.Post, $"{endpoint}/api/generate")
                {
                    Content = new StringContent(requestJson, Encoding.UTF8, "application/json")
                };
                
                // Increase timeout for streaming
                client.Timeout = TimeSpan.FromMinutes(10);
                
                try
                {
                    // Send request and get streaming response
                    using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
                    
                    // Check if successful
                    if (!response.IsSuccessStatusCode)
                    {
                        var errorContent = await response.Content.ReadAsStringAsync();
                        _logger.LogError($"Error from Ollama API: {response.StatusCode} - {errorContent}");
                        
                        try
                        {
                            using var jsonDocument = JsonDocument.Parse(errorContent);
                            if (jsonDocument.RootElement.TryGetProperty("error", out var errorElement))
                            {
                                var errorMessage = errorElement.GetString();
                                throw new Exception($"Error from Ollama API: {errorMessage}");
                            }
                        }
                        catch (JsonException)
                        {
                            // If JSON parsing fails, use the raw content
                        }
                        
                        throw new Exception($"Error from Ollama API: {response.StatusCode}");
                    }
                    
                    // Read streaming response
                    using var stream = await response.Content.ReadAsStreamAsync();
                    using var reader = new StreamReader(stream);
                    
                    // Process each line of the streaming response
                    string fullResponse = "";
                    while (!reader.EndOfStream)
                    {
                        var line = await reader.ReadLineAsync();
                        if (string.IsNullOrEmpty(line)) continue;
                        
                        try
                        {
                            // Parse JSON chunk
                            using var jsonDocument = JsonDocument.Parse(line);
                            
                            // Extract response chunk
                            if (jsonDocument.RootElement.TryGetProperty("response", out var responseElement))
                            {
                                var chunkText = responseElement.GetString();
                                if (!string.IsNullOrEmpty(chunkText))
                                {
                                    fullResponse += chunkText;
                                    await onChunkReceived(chunkText);
                                }
                            }
                            
                            // Check if done
                            if (jsonDocument.RootElement.TryGetProperty("done", out var doneElement) && 
                                doneElement.GetBoolean())
                            {
                                break;
                            }
                        }
                        catch (JsonException ex)
                        {
                            _logger.LogError(ex, $"Error parsing streaming response chunk: {line}");
                            continue;
                        }
                    }
                    
                    // Streaming completed
                    _logger.LogInformation($"Completed streaming response with model {modelId}");
                    await onComplete();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Error streaming response from Ollama: {ex.Message}");
                    await onError(ex);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error in streaming setup: {ex.Message}");
                await onError(ex);
            }
        }
        
        #region Private Helper Methods
        
        private string FormatDocumentsAsContext(List<string> documentContents, List<string> documentTitles)
        {
            var formattedDocuments = new List<string>();
            
            // Calculate token budget - use smaller context for Ollama models
            // These models typically have smaller context windows
            int maxContextLength = 2000; // Maximum chars per document
            int maxTotalContextLength = 10000; // Maximum total context size
            int currentTotalLength = 0;
            
            for (int i = 0; i < documentContents.Count && i < documentTitles.Count; i++)
            {
                string content = documentContents[i];
                string title = documentTitles[i];
                string documentType = Path.GetExtension(title).ToLowerInvariant();
                string formattedContent;
                
                // Handle different file types - be more aggressive with truncation for Ollama
                if (documentType.Contains("xls"))
                {
                    // Excel files - be very selective with content
                    formattedContent = FormatSpreadsheetContent(content, maxContextLength / 2);
                }
                else if (documentType.Contains("pdf") || documentType.Contains("doc"))
                {
                    // PDFs and Word docs - focus on key sections
                    formattedContent = FormatStructuredContent(content, maxContextLength);
                }
                else
                {
                    // Other files - simple truncation with summary
                    formattedContent = FormatGenericContent(content, maxContextLength);
                }
                
                // Create document entry with metadata
                string documentEntry = $"[Document {i+1}: {title}]\n" +
                                      $"Type: {documentType}\n" +
                                      $"Content:\n{formattedContent}\n" +
                                      $"[End of Document {i+1}]";
                
                // Check if adding this document would exceed the total context limit
                if (currentTotalLength + documentEntry.Length > maxTotalContextLength)
                {
                    // If we already have at least one document, stop adding more
                    if (formattedDocuments.Count > 0)
                    {
                        break;
                }
                
                    // If this is the first document, we need to truncate it further
                    int availableSpace = maxTotalContextLength - 
                        $"[Document {i+1}: {title}]\nType: {documentType}\nContent:\n...\n[End of Document {i+1}]".Length;
                    
                    if (availableSpace > 500) // Smaller threshold for Ollama
                    {
                        formattedContent = content.Substring(0, Math.Min(content.Length, availableSpace)) + "...";
                        documentEntry = $"[Document {i+1}: {title}]\n" +
                                       $"Type: {documentType}\n" +
                                       $"Content:\n{formattedContent}\n" +
                                       $"[End of Document {i+1}]";
                    }
                    else
                    {
                        // Not enough space for meaningful content
                        continue;
                    }
                }
                
                formattedDocuments.Add(documentEntry);
                currentTotalLength += documentEntry.Length;
            }
            
            if (formattedDocuments.Count == 0)
            {
                return "No relevant documents found in the knowledge base.";
            }
            
            return $"KNOWLEDGE BASE DOCUMENTS:\n\n{string.Join("\n\n", formattedDocuments)}\n\n" + 
                   "INSTRUCTIONS:\n" +
                   "1. Answer ONLY based on the above documents.\n" +
                   "2. Cite specific document numbers when referencing information (example: 'According to Document 1...').\n" +
                   "3. If the information isn't found in the documents, state that clearly.\n" +
                   "4. Focus on providing accurate and relevant information from the documents.";
        }
        
        private string FormatSpreadsheetContent(string content, int maxLength)
        {
            // Preserve table structure for spreadsheets
            if (content.Length <= maxLength)
            {
                return content;
            }
            
            // Try to identify rows and preserve important ones
            var lines = content.Split('\n', StringSplitOptions.RemoveEmptyEntries);
            var result = new StringBuilder();
            
            // Keep fewer rows for Ollama models
            int headersToKeep = Math.Min(3, lines.Length);
            for (int i = 0; i < headersToKeep; i++)
            {
                result.AppendLine(lines[i]);
            }
            
            result.AppendLine("...");
            
            // Add just a couple of data rows as samples
            if (lines.Length > 5)
            {
                result.AppendLine(lines[lines.Length / 2]); // One from middle
                result.AppendLine("...");
                if (lines.Length > 3)
                {
                    result.AppendLine(lines[lines.Length - 1]); // Last row
                }
            }
            
            return result.ToString();
        }
        
        private string FormatStructuredContent(string content, int maxLength)
        {
            if (content.Length <= maxLength)
            {
                return content;
            }
            
            // Try to preserve headings and structure
            var lines = content.Split('\n', StringSplitOptions.RemoveEmptyEntries);
            var result = new StringBuilder();
            
            // Extract what seem to be headings (short lines, often ending with colons)
            var headings = new List<(int index, string text)>();
            for (int i = 0; i < lines.Length; i++)
            {
                string line = lines[i].Trim();
                if (line.Length > 0 && line.Length < 80 && 
                    (char.IsUpper(line[0]) || line.EndsWith(":") || line.All(c => !char.IsPunctuation(c))))
                {
                    headings.Add((i, line));
                }
            }
            
            // If we found headings, use them to structure our truncated content
            if (headings.Count > 0)
            {
                // Add shorter document introduction
                int introLines = Math.Min(3, headings[0].index);
                for (int i = 0; i < introLines; i++)
                {
                    result.AppendLine(lines[i]);
                }
                
                result.AppendLine("...");
                
                // Add fewer sections for Ollama
                for (int h = 0; h < Math.Min(headings.Count, 3); h++)
                {
                    var heading = headings[h];
                    result.AppendLine(heading.text);
                    
                    // Find the next heading or end of document
                    int nextIndex = (h < headings.Count - 1) ? headings[h + 1].index : lines.Length;
                    
                    // Take a sample of content from this section - just one line for Ollama
                    int sectionLength = nextIndex - heading.index - 1;
                    if (sectionLength > 0)
                    {
                        result.AppendLine(lines[heading.index + 1]);
                        
                        if (sectionLength > 1)
                        {
                            result.AppendLine("...");
                        }
                    }
                }
            }
            else
            {
                // No clear structure, fall back to simple truncation
                return FormatGenericContent(content, maxLength);
            }
            
            return result.ToString();
        }
        
        private string FormatGenericContent(string content, int maxLength)
        {
            if (content.Length <= maxLength)
            {
                return content;
            }
            
            // Take beginning and end sections - skip middle for Ollama
            int beginningSize = (int)(maxLength * 0.7); // More emphasis on beginning
            int endSize = maxLength - beginningSize;
            
            var beginning = content.Substring(0, Math.Min(beginningSize, content.Length));
            
            if (content.Length <= beginningSize)
            {
                return beginning;
            }
            
            var end = content.Substring(
                Math.Max(0, content.Length - endSize),
                Math.Min(endSize, content.Length)
            );
            
            return $"{beginning}\n...\n[end section]\n{end}";
        }
        
        private string GetSystemPrompt()
        {
            // Optimized system prompt for Ollama models (shorter, more direct instructions)
            return @"You are an AI assistant answering questions based on provided documents only.

CRITICAL RULES:
1. ONLY use information from the provided documents
2. If you don't find the answer in the documents, say so clearly
3. Cite specific document numbers when providing information
4. Never use prior knowledge outside the documents

DOCUMENTS STRUCTURE:
- Each document has a title, type, and content
- Content may have [...] indicating omitted parts
- Pay attention to [middle section] and [end section] markers
- Tables and structured data should be interpreted carefully

Present your answers in a clear, organized format.

Keep your focus on accurately representing ONLY what's in the provided documents.";
        }
        
        #endregion
    }
}
