using ChattyWidget.Core.DTOs;
using ChattyWidget.Core.Interfaces;
using ChattyWidget.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Numerics;

namespace ChattyWidget.Core.Services
{
    public class EmbeddingService : IEmbeddingService
    {
        private readonly DbContext _context;
        private readonly ILogger<EmbeddingService> _logger;
        private readonly HttpClient _httpClient;
        private readonly string _ollamaEndpoint;
        private readonly string _embeddingModel;

        public EmbeddingService(DbContext context, ILogger<EmbeddingService> logger, IHttpClientFactory httpClientFactory)
        {
            _context = context;
            _logger = logger;
            _httpClient = httpClientFactory.CreateClient("OllamaClient");
            
            // Default to localhost Ollama endpoint
            _ollamaEndpoint = "http://localhost:11434/api/embeddings";
            _embeddingModel = "all-minilm"; // Default embedding model
        }

        public async Task ProcessDocumentAsync(Guid documentId)
        {
            try
            {
                _logger.LogInformation("Processing embeddings for document {DocumentId}", documentId);

                // Get the document
                var document = await _context.Set<Document>()
                    .FirstOrDefaultAsync(d => d.Id == documentId);

                if (document == null)
                {
                    _logger.LogWarning("Document {DocumentId} not found", documentId);
                    return;
                }

                // Skip if document has no content
                if (string.IsNullOrEmpty(document.Content))
                {
                    _logger.LogWarning("Document {DocumentId} has no content to process", documentId);
                    document.EmbeddingVector = "[]"; // Empty embedding
                    document.IsEmbeddingProcessed = true;
                    await _context.SaveChangesAsync();
                    return;
                }

                // Split content into chunks
                var chunks = ChunkText(document.Content, 1000); // 1000 characters per chunk

                _logger.LogInformation("Created {ChunkCount} chunks for document {DocumentId}", 
                    chunks.Count, documentId);

                // Delete any existing chunks for this document
                var existingChunks = await _context.Set<DocumentChunk>()
                    .Where(c => c.DocumentId == documentId)
                    .ToListAsync();

                if (existingChunks.Any())
                {
                    _context.Set<DocumentChunk>().RemoveRange(existingChunks);
                    await _context.SaveChangesAsync();
                }

                // First, generate document-level embedding
                var documentEmbedding = await GenerateEmbeddingAsync(document.Content);
                document.EmbeddingVector = documentEmbedding;

                // Process each chunk
                for (int i = 0; i < chunks.Count; i++)
                {
                    // Generate embedding for chunk
                    string chunkEmbedding = await GenerateEmbeddingAsync(chunks[i]);
                    
                    var chunk = new DocumentChunk
                    {
                        Id = Guid.NewGuid(),
                        DocumentId = documentId,
                        Content = chunks[i],
                        ChunkIndex = i,
                        EmbeddingVector = chunkEmbedding,
                        CreatedAt = DateTime.UtcNow
                    };

                    _context.Set<DocumentChunk>().Add(chunk);
                    
                    // Log progress for larger documents
                    if (i % 5 == 0 || i == chunks.Count - 1)
                    {
                        _logger.LogInformation("Processed {Current}/{Total} chunks for document {DocumentId}", 
                            i + 1, chunks.Count, documentId);
                    }
                }

                // Mark document as processed
                document.IsEmbeddingProcessed = true;
                
                await _context.SaveChangesAsync();
                _logger.LogInformation("Completed embedding processing for document {DocumentId}", documentId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing embeddings for document {DocumentId}", documentId);
                throw;
            }
        }

        private async Task<string> GenerateEmbeddingAsync(string text)
        {
            try
            {
                // Prepare request to Ollama
                var requestData = new
                {
                    model = _embeddingModel,
                    prompt = text
                };

                var content = new StringContent(
                    JsonSerializer.Serialize(requestData),
                    Encoding.UTF8,
                    "application/json");

                var response = await _httpClient.PostAsync(_ollamaEndpoint, content);
                
                if (response.IsSuccessStatusCode)
                {
                    var jsonResponse = await response.Content.ReadAsStringAsync();
                    var embeddingResponse = JsonDocument.Parse(jsonResponse);
                    
                    // Extract the embedding array
                    if (embeddingResponse.RootElement.TryGetProperty("embedding", out var embeddingElement))
                    {
                        return embeddingElement.ToString();
                    }
                }

                _logger.LogWarning("Failed to get embedding from Ollama: {StatusCode}", response.StatusCode);
                return "[]"; // Return empty array as fallback
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating embedding");
                return "[]"; // Return empty array on error
            }
        }

        public async Task<List<SearchResultDTO>> SearchSimilarDocumentsAsync(string query, int limit = 5)
        {
            try
            {
                // Generate embedding for the query
                var queryEmbedding = ParseEmbedding(await GenerateEmbeddingAsync(query));
                
                if (queryEmbedding.Count == 0)
                {
                    _logger.LogWarning("Could not generate valid embedding for query");
                    return await FallbackSearchAsync(query, limit);
                }

                // First try to search in document chunks
                var results = new List<SearchResultDTO>();
                
                // Get all document chunks with embeddings
                var chunks = await _context.Set<DocumentChunk>()
                    .Where(c => c.EmbeddingVector != null && c.EmbeddingVector != "[]")
                    .Include(c => c.Document)
                    .ToListAsync();
                
                _logger.LogInformation("Retrieved {ChunkCount} document chunks with embeddings", chunks.Count);
                
                if (chunks.Count > 0)
                {
                    // Calculate similarity for each chunk
                    var similarities = new List<(Guid chunkId, Guid documentId, string documentName, string content, int chunkIndex, double similarity)>();
                    
                    foreach (var chunk in chunks)
                    {
                        try
                        {
                            var chunkEmbedding = ParseEmbedding(chunk.EmbeddingVector);
                            if (chunkEmbedding.Count > 0)
                            {
                                double similarity = CosineSimilarity(queryEmbedding, chunkEmbedding);
                                similarities.Add((chunk.Id, chunk.DocumentId, chunk.Document.Name, chunk.Content, chunk.ChunkIndex, similarity));
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Error calculating similarity for chunk {ChunkId}", chunk.Id);
                        }
                    }
                    
                    // Order by similarity and use a minimum threshold - higher than before
                    double minimumSimilarityThreshold = 0.3; // Minimum threshold to consider a chunk relevant
                    var filteredResults = similarities
                        .Where(s => s.similarity >= minimumSimilarityThreshold)
                        .OrderByDescending(s => s.similarity)
                        .ToList();
                    
                    // Take more chunks than needed for post-processing
                    int initialLimit = Math.Min(limit * 3, filteredResults.Count);
                    var topResults = filteredResults.Take(initialLimit).ToList();
                    
                    // Apply reranking - combine similar chunks from the same document
                    // Group by document ID and take the highest similarity chunk for each document
                    var rerankedResults = new List<(Guid chunkId, Guid documentId, string documentName, string content, int chunkIndex, double similarity)>();
                    
                    // Group by document ID
                    var documentGroups = topResults.GroupBy(r => r.documentId).ToList();
                    
                    foreach (var group in documentGroups)
                    {
                        var docId = group.Key;
                        var docName = group.First().documentName;
                        
                        // Get top 2 chunks from this document
                        var topDocChunks = group.OrderByDescending(c => c.similarity).Take(2).ToList();
                        
                        // Combine content from top chunks if they're adjacent
                        if (topDocChunks.Count > 1 && Math.Abs(topDocChunks[0].chunkIndex - topDocChunks[1].chunkIndex) == 1)
                        {
                            // Combine adjacent chunks
                            var combinedContent = topDocChunks[0].chunkIndex < topDocChunks[1].chunkIndex
                                ? $"{topDocChunks[0].content}\n{topDocChunks[1].content}"
                                : $"{topDocChunks[1].content}\n{topDocChunks[0].content}";
                            
                            // Use the higher similarity score and the lower chunk index
                            var higherSimilarity = Math.Max(topDocChunks[0].similarity, topDocChunks[1].similarity);
                            var lowerChunkIndex = Math.Min(topDocChunks[0].chunkIndex, topDocChunks[1].chunkIndex);
                            
                            rerankedResults.Add((
                                topDocChunks[0].chunkId, 
                                docId, 
                                docName, 
                                combinedContent, 
                                lowerChunkIndex, 
                                higherSimilarity
                            ));
                        }
                        else
                        {
                            // Just add the highest similarity chunk
                            rerankedResults.Add(topDocChunks[0]);
                        }
                    }
                    
                    // Sort by similarity and take the final limit
                    var finalResults = rerankedResults
                        .OrderByDescending(r => r.similarity)
                        .Take(limit)
                        .ToList();
                    
                    _logger.LogInformation("Found {ResultCount} relevant chunks with similarity search", finalResults.Count);
                    
                    if (finalResults.Count > 0)
                    {
                        foreach (var result in finalResults)
                    {
                        results.Add(new SearchResultDTO
                        {
                            Id = result.chunkId,
                            DocumentId = result.documentId,
                            DocumentName = result.documentName,
                            Content = result.content,
                            ChunkIndex = result.chunkIndex,
                            Similarity = result.similarity
                        });
                    }
                    
                    return results;
                    }
                }
                
                // If no chunks found, try full document embeddings as fallback
                _logger.LogInformation("No chunks found, falling back to document-level embeddings");
                
                var documents = await _context.Set<Document>()
                    .Where(d => d.IsEmbeddingProcessed && d.EmbeddingVector != null && d.EmbeddingVector != "[]")
                    .ToListAsync();
                
                _logger.LogInformation("Retrieved {DocCount} documents with embeddings", documents.Count);
                
                if (documents.Count > 0)
                {
                    // Calculate similarity for each document
                    var documentSimilarities = new List<(Guid documentId, string documentName, string content, double similarity)>();
                    
                    foreach (var doc in documents)
                    {
                        try
                        {
                            var docEmbedding = ParseEmbedding(doc.EmbeddingVector);
                            if (docEmbedding.Count > 0)
                            {
                                double similarity = CosineSimilarity(queryEmbedding, docEmbedding);
                                documentSimilarities.Add((doc.Id, doc.Name, doc.Content ?? "", similarity));
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Error calculating similarity for document {DocumentId}", doc.Id);
                        }
                    }
                    
                    // Order by similarity and take top results
                    double docSimilarityThreshold = 0.2; // Lower threshold for full documents
                    var topDocuments = documentSimilarities
                        .Where(d => d.similarity >= docSimilarityThreshold)
                        .OrderByDescending(d => d.similarity)
                        .Take(limit)
                        .ToList();
                    
                    foreach (var result in topDocuments)
                    {
                        results.Add(new SearchResultDTO
                        {
                            Id = Guid.NewGuid(),
                            DocumentId = result.documentId,
                            DocumentName = result.documentName,
                            Content = result.content,
                            ChunkIndex = 0, // Default chunk index for full document
                            Similarity = result.similarity
                        });
                    }
                    
                    if (results.Count > 0)
                    {
                    return results;
                    }
                }
                
                // If still no results, try hybrid search combining vector and keyword matches
                if (results.Count == 0)
                {
                    _logger.LogWarning("No embedding-based results found, trying hybrid search");
                    return await HybridSearchAsync(query, queryEmbedding, limit);
                }
                
                return results;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error searching for similar documents");
                return await FallbackSearchAsync(query, limit);
            }
        }
        
        private List<float> ParseEmbedding(string embeddingJson)
        {
            try
            {
                var embeddings = new List<float>();
                
                // Parse JSON array of floats
                using (JsonDocument doc = JsonDocument.Parse(embeddingJson))
                {
                    var root = doc.RootElement;
                    
                    // If the embedding is directly an array
                    if (root.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var item in root.EnumerateArray())
                        {
                            if (item.TryGetSingle(out float value))
                            {
                                embeddings.Add(value);
                            }
                        }
                    }
                    // If the embedding is in a property called "embedding"
                    else if (root.TryGetProperty("embedding", out var embeddingArray) && 
                             embeddingArray.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var item in embeddingArray.EnumerateArray())
                        {
                            if (item.TryGetSingle(out float value))
                            {
                                embeddings.Add(value);
                            }
                        }
                    }
                }
                
                return embeddings;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error parsing embedding JSON: {EmbeddingJson}", embeddingJson);
                return new List<float>();
            }
        }
        
        private double CosineSimilarity(List<float> vectorA, List<float> vectorB)
        {
            // Check for empty vectors or dimension mismatch
            if (vectorA.Count == 0 || vectorB.Count == 0 || vectorA.Count != vectorB.Count)
            {
                return 0.0;
            }
            
            double dotProduct = 0.0;
            double normA = 0.0;
            double normB = 0.0;
            
            for (int i = 0; i < vectorA.Count; i++)
            {
                dotProduct += vectorA[i] * vectorB[i];
                normA += vectorA[i] * vectorA[i];
                normB += vectorB[i] * vectorB[i];
            }
            
            // Handle zero vectors
            if (normA == 0.0 || normB == 0.0)
            {
                return 0.0;
            }
            
            return dotProduct / (Math.Sqrt(normA) * Math.Sqrt(normB));
        }

        private async Task<List<SearchResultDTO>> FallbackSearchAsync(string query, int limit)
        {
            // Simple fallback search using string contains
            _logger.LogInformation("Using fallback search for query: {Query}", query);
            
            var results = new List<SearchResultDTO>();
            
            // Search in document chunks that contain the query text
            var chunks = await _context.Set<DocumentChunk>()
                .Where(c => c.Content.Contains(query))
                .Include(c => c.Document)
                .OrderBy(c => c.ChunkIndex)
                .Take(limit)
                .ToListAsync();
                
            foreach (var chunk in chunks)
            {
                results.Add(new SearchResultDTO
                {
                    Id = chunk.Id,
                    DocumentId = chunk.DocumentId,
                    DocumentName = chunk.Document.Name,
                    Content = chunk.Content,
                    ChunkIndex = chunk.ChunkIndex,
                    Similarity = 0.5 // Placeholder score for text match
                });
            }
            
            return results;
        }

        private List<string> ChunkText(string text, int targetChunkSize)
        {
            var chunks = new List<string>();
            
            if (string.IsNullOrEmpty(text) || targetChunkSize <= 0)
                return chunks;

            // Split by paragraphs first
            var paragraphs = text.Split(new[] { "\r\n\r\n", "\n\n", "\r\r" }, StringSplitOptions.RemoveEmptyEntries);
            
            var currentChunk = new StringBuilder();
            
            foreach (var paragraph in paragraphs)
            {
                // If adding this paragraph would exceed target size, add current chunk to list and start a new one
                if (currentChunk.Length > 0 && currentChunk.Length + paragraph.Length > targetChunkSize)
                {
                    chunks.Add(currentChunk.ToString());
                    currentChunk.Clear();
                }
                
                // If a single paragraph is larger than the target chunk size, split it by sentences
                if (paragraph.Length > targetChunkSize)
                {
                    var sentences = SplitIntoSentences(paragraph);
                    var sentenceChunk = new StringBuilder();
                    
                    foreach (var sentence in sentences)
                    {
                        if (sentenceChunk.Length + sentence.Length > targetChunkSize)
                        {
                            if (sentenceChunk.Length > 0)
                            {
                                chunks.Add(sentenceChunk.ToString());
                                sentenceChunk.Clear();
                            }
                            
                            // If a single sentence is longer than target size, split it arbitrarily
                            if (sentence.Length > targetChunkSize)
                            {
                                for (int i = 0; i < sentence.Length; i += targetChunkSize)
            {
                                    int length = Math.Min(targetChunkSize, sentence.Length - i);
                                    chunks.Add(sentence.Substring(i, length));
                                }
                            }
                            else
                            {
                                sentenceChunk.Append(sentence);
                            }
                        }
                        else
                        {
                            sentenceChunk.Append(sentence);
                        }
                    }
                    
                    if (sentenceChunk.Length > 0)
                    {
                        chunks.Add(sentenceChunk.ToString());
                    }
                }
                else
                {
                    currentChunk.AppendLine(paragraph);
                }
            }
            
            // Add any remaining content
            if (currentChunk.Length > 0)
            {
                chunks.Add(currentChunk.ToString());
            }
            
            // Create overlapping chunks to maintain context - overlap by 20%
            if (chunks.Count > 1)
            {
                var overlappingChunks = new List<string>();
                int overlapSize = (int)(targetChunkSize * 0.2); // 20% overlap
                
                for (int i = 0; i < chunks.Count; i++)
                {
                    string currentChunkText = chunks[i];
                    
                    // Add overlap from previous chunk if not the first chunk
                    if (i > 0)
                    {
                        string previousChunk = chunks[i - 1];
                        string overlap = previousChunk.Length > overlapSize 
                            ? previousChunk.Substring(Math.Max(0, previousChunk.Length - overlapSize)) 
                            : previousChunk;
                        
                        currentChunkText = $"{overlap}\n...\n{currentChunkText}";
                    }
                    
                    // Add overlap from next chunk if not the last chunk
                    if (i < chunks.Count - 1)
                    {
                        string nextChunk = chunks[i + 1];
                        string overlap = nextChunk.Length > overlapSize 
                            ? nextChunk.Substring(0, Math.Min(overlapSize, nextChunk.Length)) 
                            : nextChunk;
                        
                        currentChunkText = $"{currentChunkText}\n...\n{overlap}";
                    }
                    
                    overlappingChunks.Add(currentChunkText);
                }
                
                return overlappingChunks;
            }

            return chunks;
        }

        private List<string> SplitIntoSentences(string text)
        {
            // Simple sentence splitter using common sentence endings
            var sentences = new List<string>();
            var sentenceEndings = new[] { ". ", "! ", "? ", ".\n", "!\n", "?\n" };
            
            int startIndex = 0;
            while (startIndex < text.Length)
            {
                // Find the next sentence ending
                int endIndex = text.Length;
                foreach (var ending in sentenceEndings)
                {
                    int tempEnd = text.IndexOf(ending, startIndex);
                    if (tempEnd >= 0 && tempEnd < endIndex)
                    {
                        endIndex = tempEnd + ending.Length;
                    }
                }
                
                // Extract the sentence
                if (endIndex > startIndex)
                {
                    sentences.Add(text.Substring(startIndex, endIndex - startIndex));
                    startIndex = endIndex;
                }
                else
                {
                    // No more sentence endings found, add the rest of the text
                    sentences.Add(text.Substring(startIndex));
                    break;
                }
            }
            
            return sentences;
        }

        private async Task<List<SearchResultDTO>> HybridSearchAsync(string query, List<float> queryEmbedding, int limit)
        {
            // First get keyword matches
            var keywordMatches = await FallbackSearchAsync(query, limit * 2);
            
            if (keywordMatches.Count == 0 || queryEmbedding.Count == 0)
            {
                return keywordMatches;
            }
            
            // For each keyword match, calculate vector similarity if possible
            foreach (var match in keywordMatches)
            {
                try
                {
                    // Get the chunk to access its embedding
                    var chunk = await _context.Set<DocumentChunk>()
                        .FirstOrDefaultAsync(c => c.Id == match.Id);
                        
                    if (chunk != null && !string.IsNullOrEmpty(chunk.EmbeddingVector))
                    {
                        var chunkEmbedding = ParseEmbedding(chunk.EmbeddingVector);
                        if (chunkEmbedding.Count > 0)
                        {
                            double vectorSimilarity = CosineSimilarity(queryEmbedding, chunkEmbedding);
                            
                            // Hybrid scoring - combine keyword match (0.5 base) with vector similarity
                            match.Similarity = 0.3 + (0.7 * vectorSimilarity);
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error calculating hybrid score for chunk {ChunkId}", match.Id);
                }
            }
            
            // Re-sort by the hybrid score and return top results
            return keywordMatches
                .OrderByDescending(m => m.Similarity)
                .Take(limit)
                .ToList();
        }
    }
}
