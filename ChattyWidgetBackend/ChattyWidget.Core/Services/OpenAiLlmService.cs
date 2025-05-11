using ChattyWidget.Core.DTOs;
using ChattyWidget.Core.Interfaces;
using ChattyWidget.Models.Agent;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.IO;

namespace ChattyWidget.Core.Services
{
    public class OpenAiLlmService : ILlmService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly LlmProviderConfig _config;
        private readonly ILogger<OpenAiLlmService> _logger;
        private readonly Dictionary<string, string> _modelProviderMap;
        private readonly Dictionary<string, string> _modelSubscriptionLevelMap;

        public OpenAiLlmService(
            IHttpClientFactory httpClientFactory,
            IOptions<LlmProviderConfig> config,
            ILogger<OpenAiLlmService> logger)
        {
            _httpClientFactory = httpClientFactory;
            _config = config.Value;
            _logger = logger;
            
            // Initialize model-to-provider and model-to-subscription-level mappings
            _modelProviderMap = new Dictionary<string, string>
            {
                { "gpt-4o", "OpenAI" },
                { "gpt-4o-mini", "OpenAI" },
                { "llama3", "Ollama" }
            };
            
            _modelSubscriptionLevelMap = new Dictionary<string, string>
            {
                { "gpt-4o", "premium" },
                { "gpt-4o-mini", "basic" },
                { "llama3", "free" }
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
                if (!_modelProviderMap.TryGetValue(modelId, out var provider) || provider != "OpenAI")
                {
                    throw new ArgumentException($"Model {modelId} is not supported by OpenAI provider");
                }
                
                // Format documents into context for the prompt
                string context = FormatDocumentsAsContext(documentContents, documentTitles);
                
                // Create a prompt with the context and query
                var messages = new List<object>
                {
                    new { role = "system", content = GetSystemPrompt() },
                    new { role = "user", content = $"Context information is below.\n\n{context}\n\nGiven the context information and not prior knowledge, answer the question: {query}" }
                };
                
                // Create request for OpenAI API
                var requestBody = new
                {
                    model = modelId,
                    messages,
                    max_tokens = 800,
                    temperature = 0.3
                };
                
                // Serialize the request
                string requestJson = JsonSerializer.Serialize(requestBody);
                
                // Create HTTP client and request
                var client = _httpClientFactory.CreateClient();
                var request = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/chat/completions")
                {
                    Content = new StringContent(requestJson, Encoding.UTF8, "application/json")
                };
                
                // Set authorization header with API key
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _config.OpenAI.ApiKey);
                
                // Send request and get response
                var response = await client.SendAsync(request);
                
                // Process response
                if (response.IsSuccessStatusCode)
                {
                    var responseContent = await response.Content.ReadAsStringAsync();
                    var responseJson = JsonDocument.Parse(responseContent);
                    
                    // Extract content from response
                    var content = responseJson.RootElement
                        .GetProperty("choices")[0]
                        .GetProperty("message")
                        .GetProperty("content")
                        .GetString();
                    
                    // Calculate a confidence score based on temperature and other factors
                    // For now, use a fixed value, but this could be more sophisticated
                    double confidence = 0.85;
                    
                    // Create response object
                    return new LlmResponse
                    {
                        Content = content,
                        ModelId = modelId,
                        Confidence = confidence,
                        Citations = documentTitles,
                        Metadata = new Dictionary<string, object>
                        {
                            { "provider", "OpenAI" },
                            { "tokenUsage", responseJson.RootElement.GetProperty("usage").GetProperty("total_tokens").GetInt32() }
                        }
                    };
                }
                else
                {
                    // Log error and throw exception
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogError($"Error from OpenAI API: {response.StatusCode} - {errorContent}");
                    throw new Exception($"Error from LLM provider: {response.StatusCode}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error generating response with OpenAI");
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
            
            // Check if provider is OpenAI
            if (provider != "OpenAI")
            {
                return false;
            }
            
            // Check if API key is configured
            if (string.IsNullOrEmpty(_config.OpenAI.ApiKey))
            {
                return false;
            }
            
            // Check subscription level access
            if (!_modelSubscriptionLevelMap.TryGetValue(modelId, out var requiredSubscriptionLevel))
            {
                return false;
            }
            
            // Simple subscription level check (free < basic < premium)
            if (subscriptionLevel == "premium")
            {
                return true; // Premium has access to all models
            }
            else if (subscriptionLevel == "basic")
            {
                return requiredSubscriptionLevel == "basic" || requiredSubscriptionLevel == "free";
            }
            else if (subscriptionLevel == "free")
            {
                return requiredSubscriptionLevel == "free";
            }
            
            return false;
        }
        
        public string GetProviderForModel(string modelId)
        {
            return _modelProviderMap.TryGetValue(modelId, out var provider) ? provider : null;
        }
        
        public Task<List<string>> GetAvailableOllamaModelsAsync()
        {
            // OpenAI service doesn't provide Ollama models, so return an empty list
            return Task.FromResult(new List<string>());
        }
        
        public Task StreamResponseAsync(
            string query, 
            List<string> documentContents, 
            List<string> documentTitles, 
            string modelId, 
            Func<string, Task> onChunkReceived, 
            Func<Exception, Task> onError, 
            Func<Task> onComplete)
        {
            // For now, provide a simple implementation that wraps the non-streaming method
            // A proper streaming implementation for OpenAI would use SSE (Server-Sent Events)
            return Task.Run(async () =>
            {
                try
                {
                    var response = await GenerateResponseAsync(query, documentContents, documentTitles, modelId);
                    await onChunkReceived(response.Content);
                    await onComplete();
                }
                catch (Exception ex)
                {
                    await onError(ex);
                }
            });
        }
        
        #region Private Helper Methods
        
        private string FormatDocumentsAsContext(List<string> documentContents, List<string> documentTitles)
        {
            var formattedDocuments = new List<string>();
            
            // Calculate token budget - allow more content per document
            // Using rough token estimates for GPT models (1 token ~= 4 chars)
            int maxContextLength = 3000; // Maximum chars per document, increased from 1500
            int maxTotalContextLength = 14000; // Maximum total context size
            int currentTotalLength = 0;
            
            for (int i = 0; i < documentContents.Count && i < documentTitles.Count; i++)
            {
                string content = documentContents[i];
                string title = documentTitles[i];
                string documentType = Path.GetExtension(title).ToLowerInvariant();
                string formattedContent;
                
                // Handle different file types
                if (documentType.Contains("xls"))
                {
                    // Excel files - reduce size but keep structure
                    formattedContent = FormatSpreadsheetContent(content, maxContextLength);
                }
                else if (documentType.Contains("pdf") || documentType.Contains("doc"))
                {
                    // PDFs and Word docs - preserve structure and headings
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
                    
                    if (availableSpace > 1000) // Ensure we have reasonable space
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
            
            // Keep header rows and a sample of data rows
            int headersToKeep = Math.Min(5, lines.Length);
            for (int i = 0; i < headersToKeep; i++)
            {
                result.AppendLine(lines[i]);
            }
            
            result.AppendLine("...");
            
            // Add some middle rows if available
            if (lines.Length > 10)
            {
                int midPoint = lines.Length / 2;
                for (int i = midPoint; i < Math.Min(midPoint + 3, lines.Length); i++)
                {
                    result.AppendLine(lines[i]);
                }
                
                result.AppendLine("...");
            }
            
            // Add some end rows
            int rowsToKeepFromEnd = Math.Min(3, lines.Length);
            for (int i = lines.Length - rowsToKeepFromEnd; i < lines.Length; i++)
            {
                result.AppendLine(lines[i]);
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
                if (line.Length > 0 && line.Length < 100 && 
                    (char.IsUpper(line[0]) || line.EndsWith(":") || line.All(c => !char.IsPunctuation(c))))
                {
                    headings.Add((i, line));
                }
            }
            
            // If we found headings, use them to structure our truncated content
            if (headings.Count > 0)
            {
                // Add document introduction
                int introLines = Math.Min(5, headings[0].index);
                for (int i = 0; i < introLines; i++)
                {
                    result.AppendLine(lines[i]);
                }
                
                result.AppendLine("...");
                
                // Add content from important sections
                for (int h = 0; h < Math.Min(headings.Count, 5); h++)
                {
                    var heading = headings[h];
                    result.AppendLine(heading.text);
                    
                    // Find the next heading or end of document
                    int nextIndex = (h < headings.Count - 1) ? headings[h + 1].index : lines.Length;
                    
                    // Take a sample of content from this section
                    int sectionLength = nextIndex - heading.index - 1;
                    int linesToTake = Math.Min(3, sectionLength);
                    
                    for (int i = heading.index + 1; i < heading.index + 1 + linesToTake; i++)
                    {
                        result.AppendLine(lines[i]);
                    }
                    
                    if (sectionLength > linesToTake)
                    {
                        result.AppendLine("...");
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
            
            // Take beginning, middle and end sections
            int sectionSize = maxLength / 3;
            
            var beginning = content.Substring(0, sectionSize);
            var middle = content.Substring(
                (content.Length / 2) - (sectionSize / 2), 
                sectionSize
            );
            var end = content.Substring(
                content.Length - sectionSize,
                sectionSize
            );
            
            return $"{beginning}\n...\n[middle section]\n{middle}\n...\n[end section]\n{end}";
        }
        
        private string GetSystemPrompt()
        {
            // Use configured system prompt if available, otherwise use default
            if (!string.IsNullOrEmpty(_config.SystemPrompt))
            {
                return _config.SystemPrompt;
            }

            // Enhanced system prompt with better document understanding instructions
            return @"You are an AI assistant with access to a knowledge base of documents. 
Your primary responsibility is to answer questions using ONLY the information provided in the document context.

DOCUMENT ANALYSIS GUIDELINES:
1. NEVER provide information that is not contained in the given context documents.
2. If the context doesn't contain the relevant information, clearly state that the information isn't available in the knowledge base.
3. Do not rely on prior knowledge - only use what's in the provided document context.
4. When citing information, reference the specific document title and number it came from (e.g., 'According to Document 1...').
5. Analyze the context thoroughly before answering.
6. If multiple documents have conflicting information, acknowledge the discrepancy.

RESPONSE FORMAT:
1. Present information in a clear, structured format.
2. For numerical data or tables, maintain the precise formatting in your response.
3. If appropriate, use bullet points or numbered lists to organize information.
4. Include direct quotes from the documents when they provide clear answers.
5. If the answer requires synthesizing information from multiple documents, explain how they connect.

SPECIAL DOCUMENT HANDLING:
1. Pay close attention to document types (PDF, Excel, etc.) mentioned in the context.
2. For spreadsheet data, preserve tabular relationships between values.
3. For sections marked with '[middle section]' or '[end section]', understand they're not adjacent in the original document.
4. When documents contain ellipses (...), recognize this indicates omitted content.

Your goal is to be accurate, helpful, and thorough while strictly limiting your responses to what can be found in the provided documents.";
        }
        
        #endregion
    }
}
