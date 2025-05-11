using ChattyWidget.Core.Interfaces;
using ChattyWidget.Core.Models;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using DocModel = ChattyWidget.Models.Document;
using System.Text;
using System.Net.Http;
using HtmlAgilityPack;

namespace ChattyWidget.Core.Services
{
    public class DocumentService : IDocumentService
    {
        private readonly ILogger<DocumentService> _logger;
        private readonly IDocumentRepository _documentRepository;

        public DocumentService(ILogger<DocumentService> logger, IDocumentRepository documentRepository)
        {
            _logger = logger;
            _documentRepository = documentRepository;
        }

        public async Task<Document> GetDocumentAsync(string id)
        {
            _logger.LogInformation($"Getting document with ID: {id}");
            
            try
            {
                if (!Guid.TryParse(id, out Guid documentId))
                {
                    _logger.LogWarning($"Invalid document ID format: {id}");
                    return null;
                }
                
                var dbDocument = await _documentRepository.GetDocumentByIdAsync(documentId);
                
                if (dbDocument == null)
                {
                    _logger.LogWarning($"Document with ID {id} not found");
                    return null;
                }
                
                // Map from DB model to Core model
                var document = new Document
                {
                    Id = dbDocument.Id,
                    Name = dbDocument.Name,
                    ContentType = dbDocument.ContentType,
                    Size = dbDocument.Size,
                    UploadDate = dbDocument.UploadDate,
                    UserId = dbDocument.UserId,
                    FileUrl = dbDocument.FileUrl,
                    Content = dbDocument.Content,
                    Type = dbDocument.Type,
                    Status = dbDocument.Status,
                    Metadata = dbDocument.Metadata,
                    ErrorMessage = dbDocument.ErrorMessage,
                    OriginalFileName = dbDocument.OriginalFileName
                };

                // For website documents, ensure content is available
                if (document.Type?.ToLower() == "website" && string.IsNullOrEmpty(document.Content))
                {
                    _logger.LogInformation($"Fetching website content for document {id}");
                    try
                    {
                        // Parse metadata to get the original URL and crawl settings
                        var metadata = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(
                            document.Metadata ?? "{}"
                        );

                        if (metadata != null && metadata.TryGetValue("BaseUrl", out var baseUrl))
                        {
                            bool excludeNavigation = metadata.TryGetValue("ExcludeNavigation", out var excludeNav) && (bool)excludeNav;
                            
                            // Re-crawl the website if needed
                            using var httpClient = new HttpClient();
                            var response = await httpClient.GetAsync(baseUrl.ToString());
                            if (response.IsSuccessStatusCode)
                            {
                                var html = await response.Content.ReadAsStringAsync();
                                var doc = new HtmlDocument();
                                doc.LoadHtml(html);

                                // Remove unwanted elements
                                var nodesToRemove = new List<HtmlNode>();
                                
                                if (excludeNavigation)
                                {
                                    // Common navigation and footer selectors
                                    var navSelectors = new[] { "//nav", "//header", "//footer", "//*[contains(@class, 'nav')]", "//*[contains(@class, 'menu')]", "//*[contains(@class, 'footer')]" };
                                    foreach (var selector in navSelectors)
                                    {
                                        var nodes = doc.DocumentNode.SelectNodes(selector);
                                        if (nodes != null)
                                        {
                                            nodesToRemove.AddRange(nodes);
                                        }
                                    }
                                }
                                
                                // Remove script, style, and other non-content elements
                                var nonContentSelectors = new[] { "//script", "//style", "//noscript", "//iframe", "//svg", "//form" };
                                foreach (var selector in nonContentSelectors)
                                {
                                    var nodes = doc.DocumentNode.SelectNodes(selector);
                                    if (nodes != null)
                                    {
                                        nodesToRemove.AddRange(nodes);
                                    }
                                }
                                
                                // Remove the nodes
                                foreach (var node in nodesToRemove.Distinct())
                                {
                                    node.Remove();
                                }

                                // Extract content with structure
                                var content = new StringBuilder();
                                
                                // Get main content area if it exists
                                var mainContent = doc.DocumentNode.SelectNodes("//*[self::main or self::article or contains(@class, 'content') or contains(@class, 'main')]")?.FirstOrDefault()
                                    ?? doc.DocumentNode.SelectNodes("//body")?.FirstOrDefault()
                                    ?? doc.DocumentNode;

                                // Process headings and paragraphs
                                var contentNodes = mainContent.SelectNodes(".//h1 | .//h2 | .//h3 | .//h4 | .//h5 | .//h6 | .//p | .//li");
                                if (contentNodes != null)
                                {
                                    foreach (var node in contentNodes)
                                    {
                                        var text = node.InnerText.Trim();
                                        if (!string.IsNullOrWhiteSpace(text))
                                        {
                                            // Add appropriate formatting based on tag
                                            if (node.Name.StartsWith("h"))
                                            {
                                                content.AppendLine($"\n# {text}\n");
                                            }
                                            else if (node.Name == "li")
                                            {
                                                content.AppendLine($"• {text}");
                                            }
                                            else
                                            {
                                                content.AppendLine($"{text}\n");
                                            }
                                        }
                                    }
                                }

                                document.Content = content.ToString().Trim();
                                
                                // Update the database with the new content
                                dbDocument.Content = document.Content;
                                await _documentRepository.UpdateDocumentAsync(dbDocument);
                                
                                _logger.LogInformation($"Successfully updated website content for document {id}");
                            }
                            else
                            {
                                _logger.LogWarning($"Failed to fetch website content: {response.StatusCode} - {response.ReasonPhrase}");
                            }
                        }
                        else
                        {
                            _logger.LogWarning($"No BaseUrl found in metadata for website document {id}");
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, $"Error fetching website content for document {id}");
                        // Don't throw - we'll return the document without content
                    }
                }
                
                return document;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting document with ID: {id}");
                throw;
            }
        }

        public async Task<List<Document>> SearchDocumentsAsync(string query)
        {
            _logger.LogInformation($"Searching documents with query: {query}");
            
            try
            {
                // Use a fixed user ID for demo purposes
                // In a real implementation, this would come from the authenticated user
                var userId = Guid.Parse("00000000-0000-0000-0000-000000000001");
                
                // Get relevant documents from the repository
                var dbDocuments = await _documentRepository.GetRelevantDocumentsForQueryAsync(userId, query);
                
                // Map from DB models to Core models
                var documents = dbDocuments.Select(d => new Document
                {
                    Id = d.Id,
                    Name = d.Name,
                    ContentType = d.ContentType,
                    Size = d.Size,
                    UploadDate = d.UploadDate,
                    UserId = d.UserId,
                    FileUrl = d.FileUrl,
                    Content = d.Content,
                    Type = d.Type,
                    Status = d.Status,
                    Metadata = d.Metadata,
                    ErrorMessage = d.ErrorMessage,
                    OriginalFileName = d.OriginalFileName
                }).ToList();
                
                _logger.LogInformation($"Found {documents.Count} documents matching query: {query}");
                
                return documents;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error searching documents with query: {query}");
                throw;
            }
        }

        public async Task<byte[]> GetDocumentContentAsync(string id)
        {
            _logger.LogInformation($"Getting document content for ID: {id}");
            
            try
            {
                var document = await GetDocumentAsync(id);
                
                if (document == null)
                {
                    _logger.LogWarning($"Document with ID {id} not found");
                    return null;
                }
                
                // For Excel files, return the raw file content
                if (document.ContentType?.Contains("spreadsheet", StringComparison.OrdinalIgnoreCase) == true ||
                    document.Type?.EndsWith("xlsx", StringComparison.OrdinalIgnoreCase) == true ||
                    document.Type?.EndsWith("xls", StringComparison.OrdinalIgnoreCase) == true)
                {
                    if (!string.IsNullOrEmpty(document.FileUrl) && File.Exists(document.FileUrl))
                    {
                        return await File.ReadAllBytesAsync(document.FileUrl);
                    }
                }
                
                // For other file types, return the processed content
                return System.Text.Encoding.UTF8.GetBytes(document.Content ?? string.Empty);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting document content for ID: {id}");
                throw;
            }
        }

        public async Task<string> ExtractContentAsync(string id)
        {
            _logger.LogInformation($"Extracting text content for document ID: {id}");
            
            try
            {
                // Get the document
                var document = await GetDocumentAsync(id);
                
                if (document == null)
                {
                    _logger.LogWarning($"Document with ID {id} not found");
                    return null;
                }
                
                // In a real implementation, this would use document parsing libraries based on file type
                // For now, just return the stored text content
                return document.Content;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error extracting text content for document ID: {id}");
                throw;
            }
        }

        public async Task<Document> GetDocumentByIdAsync(Guid documentId)
        {
            _logger.LogInformation($"Getting document with ID: {documentId}");
            
            try
            {
                var dbDocument = await _documentRepository.GetDocumentByIdAsync(documentId);
                
                if (dbDocument == null)
                {
                    _logger.LogWarning($"Document with ID {documentId} not found");
                    return null;
                }
                
                // Map from DB model to Core model
                var document = new Document
                {
                    Id = dbDocument.Id,
                    Name = dbDocument.Name,
                    ContentType = dbDocument.ContentType,
                    Size = dbDocument.Size,
                    UploadDate = dbDocument.UploadDate,
                    UserId = dbDocument.UserId,
                    FileUrl = dbDocument.FileUrl,
                    Content = dbDocument.Content,
                    Type = dbDocument.Type,
                    Status = dbDocument.Status,
                    Metadata = dbDocument.Metadata,
                    ErrorMessage = dbDocument.ErrorMessage,
                    OriginalFileName = dbDocument.OriginalFileName
                };
                
                return document;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting document with ID: {documentId}");
                throw;
            }
        }
    }
}
