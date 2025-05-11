using ChattyWidget.Core.DTOs;
using ChattyWidget.Core.Interfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Linq;
using ChattyWidget.Models.Agent;
using System.IO;
using System.Net.Http.Json;

namespace ChattyWidget.Core.Services
{
    public class DeepSeekLlmService : ILlmService, IDisposable
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly LlmProviderConfig _config;
        private readonly ILogger<DeepSeekLlmService> _logger;

        public DeepSeekLlmService(
            IHttpClientFactory httpClientFactory,
            IOptions<LlmProviderConfig> config,
            ILogger<DeepSeekLlmService> logger)
        {
            _httpClientFactory = httpClientFactory;
            _config = config.Value;
            _logger = logger;
        }

        public async Task<LlmResponse> GenerateResponseAsync(
            string query, 
            List<string> documentContents, 
            List<string> documentTitles, 
            string modelId)
        {
            try
            {
                _logger.LogInformation($"Generating response with DeepSeek API for query: {query}");
                
                // Get document file paths from document service
                var documentFiles = await GetDocumentFilesAsync(documentTitles);
                
                if (documentFiles.Count == 0)
                {
                    // Fall back to text-based context if no files available
                    return await GenerateResponseWithTextContextAsync(query, documentContents, documentTitles, modelId);
                }
                
                // Use the configured system prompt
                string systemPrompt = _config.SystemPrompt;
                
                // Create HTTP client with authorization
                var client = _httpClientFactory.CreateClient();
                client.DefaultRequestHeaders.Authorization = 
                    new AuthenticationHeaderValue("Bearer", _config.DeepSeek.ApiKey);
                
                // First, upload documents to DeepSeek API
                var uploadedFiles = new List<string>();
                var uploadedDocuments = new List<DocumentFileInfo>();
                foreach (var docInfo in documentFiles)
                {
                    var fileId = await UploadFileToDeepSeekAsync(client, docInfo.FilePath);
                    if (!string.IsNullOrEmpty(fileId))
                    {
                        uploadedFiles.Add(fileId);
                        uploadedDocuments.Add(docInfo);
                    }
                }
                
                if (uploadedFiles.Count == 0)
                {
                    // Fall back to text-based context if file uploads failed
                    _logger.LogWarning("File uploads to DeepSeek failed, falling back to text context");
                    return await GenerateResponseWithTextContextAsync(query, documentContents, documentTitles, modelId);
                }
                
                // Create messages for DeepSeek API with file references
                var messages = new List<object>
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user", content = $"Question: {query}\n\nExtract and present all relevant information from the provided documents in a clear, well-formatted manner. Include all numeric values exactly as they appear in the document. If analyzing a spreadsheet, include all hours, totals, and breakdowns with their exact values." }
                };
                
                // Create request body for DeepSeek API with file references
                var requestBody = new
                {
                    model = modelId ?? "deepseek-chat",
                    messages = messages,
                    file_ids = uploadedFiles,
                    temperature = 0.3,
                    max_tokens = 1500,
                    stream = false
                };
                
                // Make request to DeepSeek API
                var requestJson = JsonSerializer.Serialize(requestBody);
                var requestContent = new StringContent(requestJson, Encoding.UTF8, "application/json");
                var response = await client.PostAsync("https://api.deepseek.com/v1/chat/completions", requestContent);
                
                // Check for success
                if (!response.IsSuccessStatusCode)
                {
                    // Read the error response body for more details
                    string errorBody = await response.Content.ReadAsStringAsync();
                    _logger.LogError("DeepSeek API error: {StatusCode} - {ErrorBody}", response.StatusCode, errorBody);
                    
                    // Return a fallback response
                    return new LlmResponse
                    {
                        Content = "Error connecting to DeepSeek API. Please try again with a local model.",
                        Confidence = 0.0,
                        ModelId = modelId ?? "deepseek-chat",
                        Metadata = new Dictionary<string, object>
                        {
                            { "error", true },
                            { "statusCode", (int)response.StatusCode },
                            { "errorMessage", errorBody }
                        }
                    };
                }
                
                // Parse response
                var responseJson = await response.Content.ReadAsStringAsync();
                var responseObj = JsonSerializer.Deserialize<JsonElement>(responseJson);
                
                string generatedText = responseObj
                    .GetProperty("choices")[0]
                    .GetProperty("message")
                    .GetProperty("content")
                    .GetString();
                
                // Extract sources from uploaded documents
                var sources = new List<ChattyWidget.Models.Agent.DocumentReference>();
                if (uploadedDocuments.Count > 0)
                {
                    foreach (var doc in uploadedDocuments)
                    {
                        sources.Add(new ChattyWidget.Models.Agent.DocumentReference
                        {
                            DocumentId = doc.DocumentId,
                            Title = doc.Title,
                            Url = $"/api/documents/view/{doc.DocumentId}",
                            Relevance = 0.9 // High relevance for uploaded documents
                        });
                    }
                }
                // Add any additional sources from document titles not in uploaded docs
                else if (documentTitles != null)
                {
                    for (int i = 0; i < Math.Min(documentContents.Count, documentTitles.Count); i++)
                    {
                        sources.Add(new ChattyWidget.Models.Agent.DocumentReference
                        {
                            DocumentId = $"doc{i}",
                            Title = documentTitles[i],
                            Url = $"/api/documents/view/{i}",
                            Relevance = 0.9 - (0.1 * i) // Assign decreasing relevance
                        });
                    }
                }
                
                var responseId = Guid.NewGuid().ToString();
                
                // Create response with the correct structure
                return new LlmResponse
                {
                    Content = generatedText,
                    Citations = documentTitles?.Take(Math.Min(documentContents.Count, documentTitles.Count)).ToList() ?? new List<string>(),
                    Confidence = 0.9,
                    ModelId = modelId ?? "deepseek-chat",
                    Metadata = new Dictionary<string, object>
                    {
                        { "responseId", responseId },
                        { "needsHumanReview", false },
                        { "sources", sources }
                    }
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating response with DeepSeek API");
                throw;
            }
        }
        
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
                _logger.LogInformation($"Streaming response with DeepSeek API for query: {query}");
                
                // Get document file paths
                var documentFiles = await GetDocumentFilesAsync(documentTitles);
                bool useFileUpload = documentFiles.Count > 0;
                
                // Create HTTP client with authorization
                var client = _httpClientFactory.CreateClient();
                client.DefaultRequestHeaders.Authorization = 
                    new AuthenticationHeaderValue("Bearer", _config.DeepSeek.ApiKey);
                
                // Use the configured system prompt
                string systemPrompt = _config.SystemPrompt;
                
                // Prepare request body
                object requestBody = null;
                
                if (useFileUpload)
                {
                    // First, upload documents to DeepSeek API
                    var uploadedFiles = new List<string>();
                    var uploadedDocuments = new List<DocumentFileInfo>();
                    foreach (var docInfo in documentFiles)
                    {
                        var fileId = await UploadFileToDeepSeekAsync(client, docInfo.FilePath);
                        if (!string.IsNullOrEmpty(fileId))
                        {
                            uploadedFiles.Add(fileId);
                            uploadedDocuments.Add(docInfo);
                        }
                    }
                    
                    if (uploadedFiles.Count == 0)
                    {
                        // Fall back to text context if file uploads failed
                        useFileUpload = false;
                    }
                    else
                    {
                        // Create messages for DeepSeek API with file references
                        var messages = new List<object>
                        {
                            new { role = "system", content = systemPrompt },
                            new { role = "user", content = $"Question: {query}\n\nExtract and present all relevant information from the provided documents in a clear, well-formatted manner. Include all numeric values exactly as they appear in the document. If analyzing a spreadsheet, include all hours, totals, and breakdowns with their exact values." }
                        };
                        
                        // Create request body with file IDs
                        requestBody = new
                        {
                            model = modelId ?? "deepseek-chat",
                            messages = messages,
                            file_ids = uploadedFiles,
                            temperature = 0.3,
                            max_tokens = 1500,
                            stream = true
                        };
                    }
                }
                
                // If not using file upload or fallback needed
                if (!useFileUpload)
                {
                    // Format documents into context
                    string context = FormatDocumentsAsContext(documentContents, documentTitles);
                    
                    // Create messages for DeepSeek API
                    var messages = new List<object>
                    {
                        new { role = "system", content = systemPrompt },
                        new { role = "user", content = $"Context information is below.\n\n{context}\n\nQuestion: {query}\n\nExtract and present all relevant information in a clear, well-formatted manner. Include all numeric values exactly as they appear in the document. If analyzing a spreadsheet, include all hours, totals, and breakdowns with their exact values." }
                    };
                    
                    // Create standard request body
                    requestBody = new
                    {
                        model = modelId ?? "deepseek-chat",
                        messages = messages,
                        temperature = 0.3,
                        max_tokens = 1500,
                        stream = true
                    };
                }
                
                // Make streaming request to DeepSeek API
                var requestJson = JsonSerializer.Serialize(requestBody);
                var requestContent = new StringContent(requestJson, Encoding.UTF8, "application/json");
                
                var request = new HttpRequestMessage(HttpMethod.Post, "https://api.deepseek.com/v1/chat/completions");
                request.Content = requestContent;
                
                var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
                
                if (!response.IsSuccessStatusCode)
                {
                    // Read the error response body for more details
                    string errorBody = await response.Content.ReadAsStringAsync();
                    _logger.LogError("DeepSeek API error: {StatusCode} - {ErrorBody}", response.StatusCode, errorBody);
                    
                    // Inform the user about the error
                    await onChunkReceived("Error connecting to DeepSeek API. Falling back to local processing...");
                    
                    // Call onComplete to signal completion
                    await onComplete();
                    return;
                }
                
                using var stream = await response.Content.ReadAsStreamAsync();
                using var reader = new System.IO.StreamReader(stream);
                
                StringBuilder fullResponse = new StringBuilder();
                
                // Process the stream
                while (!reader.EndOfStream)
                {
                    var line = await reader.ReadLineAsync();
                    if (string.IsNullOrEmpty(line) || line == "data: [DONE]")
                        continue;
                    
                    if (line.StartsWith("data: "))
                    {
                        var json = line.Substring(6); // Remove "data: " prefix
                        
                        try
                        {
                            var chunk = JsonSerializer.Deserialize<JsonElement>(json);
                            if (chunk.TryGetProperty("choices", out var choices) && 
                                choices.GetArrayLength() > 0 &&
                                choices[0].TryGetProperty("delta", out var delta) &&
                                delta.TryGetProperty("content", out var contentElement))
                            {
                                var textChunk = contentElement.GetString() ?? string.Empty;
                                fullResponse.Append(textChunk);
                                await onChunkReceived(textChunk);
                            }
                        }
                        catch (JsonException jex)
                        {
                            _logger.LogWarning(jex, "Error parsing streaming chunk: {Line}", line);
                        }
                    }
                }
                
                _logger.LogInformation($"Completed streaming response with {fullResponse.Length} characters");
                
                // Call onComplete without parameters as per interface
                await onComplete();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error streaming response with DeepSeek API");
                await onError(ex);
            }
        }
        
        public bool IsModelAvailable(string modelId, string subscriptionLevel)
        {
            // DeepSeek models are cloud-based and always available if API key is valid
            return !string.IsNullOrEmpty(_config.DeepSeek.ApiKey);
        }
        
        public string GetProviderForModel(string modelId)
        {
            return "DeepSeek";
        }
        
        public async Task<List<string>> GetAvailableOllamaModelsAsync()
        {
            // Not applicable for DeepSeek
            return new List<string>();
        }
        
        private string FormatDocumentsAsContext(List<string> documentContents, List<string> documentTitles)
        {
            return LimitContextSize(documentContents, documentTitles, 40000);
        }
        
        private string LimitContextSize(List<string> documentContents, List<string> documentTitles, int maxTokens)
        {
            var sb = new StringBuilder();
            int estimatedTokens = 0;
            int tokensPerChar = 4; // Rough estimate: 4 characters per token
            int maxCharsPerDocument = maxTokens / tokensPerChar / Math.Max(1, documentContents.Count);
            
            // Format the documents with titles if available, limiting size
            for (int i = 0; i < documentContents.Count; i++)
            {
                string title = (documentTitles != null && i < documentTitles.Count) 
                    ? documentTitles[i] 
                    : $"Document {i+1}";
                
                string content = documentContents[i];
                
                // Truncate content if too large
                if (content.Length > maxCharsPerDocument)
                {
                    content = content.Substring(0, maxCharsPerDocument) + "\n[Document truncated due to size limitations]";
                }
                
                sb.AppendLine($"--- {title} ---");
                sb.AppendLine(content);
                sb.AppendLine();
                
                estimatedTokens += (title.Length + content.Length) / tokensPerChar;
                if (estimatedTokens >= maxTokens)
                {
                    sb.AppendLine("[Additional documents omitted due to context size limitations]");
                    break;
                }
            }
            
            return sb.ToString();
        }
        
        private class DocumentFileInfo
        {
            public string FilePath { get; set; }
            public string Title { get; set; }
            public string DocumentId { get; set; }
        }
        
        private async Task<List<DocumentFileInfo>> GetDocumentFilesAsync(List<string> documentTitles)
        {
            // This would typically use a document service to get file paths
            // For now, we'll implement a simple version that looks in the uploads directory
            var result = new List<DocumentFileInfo>();
            
            if (documentTitles == null || documentTitles.Count == 0)
                return result;
                
            string uploadsDirectory = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "uploads");
            
            for (int i = 0; i < documentTitles.Count; i++)
            {
                var title = documentTitles[i];
                // Look for files with matching names
                if (Directory.Exists(uploadsDirectory))
                {
                    var files = Directory.GetFiles(uploadsDirectory);
                    var matchingFile = files.FirstOrDefault(f => Path.GetFileNameWithoutExtension(f).Contains(title));
                    
                    if (!string.IsNullOrEmpty(matchingFile))
                    {
                        result.Add(new DocumentFileInfo
                        {
                            FilePath = matchingFile,
                            Title = title,
                            DocumentId = $"doc{i}"
                        });
                    }
                }
            }
            
            return result;
        }
        
        private async Task<string> UploadFileToDeepSeekAsync(HttpClient client, string filePath)
        {
            try
            {
                _logger.LogInformation($"Uploading file to DeepSeek: {filePath}");
                
                using var fileContent = new MultipartFormDataContent();
                using var fileStream = new FileStream(filePath, FileMode.Open, FileAccess.Read);
                using var streamContent = new StreamContent(fileStream);
                
                fileContent.Add(streamContent, "file", Path.GetFileName(filePath));
                fileContent.Add(new StringContent("assistants"), "purpose");
                
                var response = await client.PostAsync("https://api.deepseek.com/v1/files", fileContent);
                
                if (!response.IsSuccessStatusCode)
                {
                    string errorBody = await response.Content.ReadAsStringAsync();
                    _logger.LogError("DeepSeek API file upload error: {StatusCode} - {ErrorBody}", response.StatusCode, errorBody);
                    return null;
                }
                
                var responseJson = await response.Content.ReadAsStringAsync();
                var responseObj = JsonSerializer.Deserialize<JsonElement>(responseJson);
                
                if (responseObj.TryGetProperty("id", out var idElement))
                {
                    string fileId = idElement.GetString();
                    _logger.LogInformation($"File uploaded successfully with ID: {fileId}");
                    return fileId;
                }
                
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading file to DeepSeek API");
                return null;
            }
        }
        
        private async Task<LlmResponse> GenerateResponseWithTextContextAsync(
            string query, 
            List<string> documentContents, 
            List<string> documentTitles, 
            string modelId)
        {
            // Format documents into context
            string context = FormatDocumentsAsContext(documentContents, documentTitles);
            
            // Use the configured system prompt
            string systemPrompt = _config.SystemPrompt ?? "You are an AI assistant specializing in data extraction and analysis. When analyzing documents, especially spreadsheets and tables, extract all numeric values precisely. Format your responses in a clean, professional manner with proper spacing and alignment. Always include all numerical data from the document, even if it seems insignificant. For spreadsheets, preserve the exact numbers without rounding or abbreviating.";
            
            // Create messages for DeepSeek API
            var messages = new List<object>
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = $"Context information is below.\n\n{context}\n\nQuestion: {query}\n\nExtract and present all relevant information in a clear, well-formatted manner. Include all numeric values exactly as they appear in the document. If analyzing a spreadsheet, include all hours, totals, and breakdowns with their exact values." }
            };
            
            // Create request body for DeepSeek API
            var requestBody = new
            {
                model = modelId ?? "deepseek-chat",
                messages = messages,
                temperature = 0.3,
                max_tokens = 1500,
                stream = false
            };
            
            // Create HTTP client with authorization
            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization = 
                new AuthenticationHeaderValue("Bearer", _config.DeepSeek.ApiKey);
            
            // Make request to DeepSeek API
            var requestJson = JsonSerializer.Serialize(requestBody);
            var requestContent = new StringContent(requestJson, Encoding.UTF8, "application/json");
            var response = await client.PostAsync("https://api.deepseek.com/v1/chat/completions", requestContent);
            
            // Check for success
            if (!response.IsSuccessStatusCode)
            {
                // Read the error response body for more details
                string errorBody = await response.Content.ReadAsStringAsync();
                _logger.LogError("DeepSeek API error: {StatusCode} - {ErrorBody}", response.StatusCode, errorBody);
                
                // Return a fallback response
                return new LlmResponse
                {
                    Content = "Error connecting to DeepSeek API. Please try again with a local model.",
                    Confidence = 0.0,
                    ModelId = modelId ?? "deepseek-chat",
                    Metadata = new Dictionary<string, object>
                    {
                        { "error", true },
                        { "statusCode", (int)response.StatusCode },
                        { "errorMessage", errorBody }
                    }
                };
            }
            
            // Parse response
            var responseJson = await response.Content.ReadAsStringAsync();
            var responseObj = JsonSerializer.Deserialize<JsonElement>(responseJson);
            
            string generatedText = responseObj
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString();
            
            // Extract sources if present
            var sources = new List<ChattyWidget.Models.Agent.DocumentReference>();
            if (documentTitles != null)
            {
                for (int i = 0; i < Math.Min(documentContents.Count, documentTitles.Count); i++)
                {
                    sources.Add(new ChattyWidget.Models.Agent.DocumentReference
                    {
                        DocumentId = $"doc{i}",
                        Title = documentTitles[i],
                        Url = $"/api/documents/view/{i}",
                        Relevance = 0.9 - (0.1 * i) // Assign decreasing relevance
                    });
                }
            }
            
            var responseId = Guid.NewGuid().ToString();
            
            // Create response with the correct structure
            return new LlmResponse
            {
                Content = generatedText,
                Citations = documentTitles?.Take(Math.Min(documentContents.Count, documentTitles.Count)).ToList() ?? new List<string>(),
                Confidence = 0.9,
                ModelId = modelId ?? "deepseek-chat",
                Metadata = new Dictionary<string, object>
                {
                    { "responseId", responseId },
                    { "needsHumanReview", false },
                    { "sources", sources }
                }
            };
        }
        
        public void Dispose()
        {
            // Clean up any resources if needed
        }
    }
}
