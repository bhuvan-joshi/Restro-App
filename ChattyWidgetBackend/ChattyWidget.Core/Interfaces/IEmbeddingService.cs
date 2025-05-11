using ChattyWidget.Core.DTOs;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace ChattyWidget.Core.Interfaces
{
    public interface IEmbeddingService
    {
        /// <summary>
        /// Process a document to generate embeddings
        /// </summary>
        Task ProcessDocumentAsync(Guid documentId);
        
        /// <summary>
        /// Search for similar document chunks using a query text
        /// </summary>
        Task<List<SearchResultDTO>> SearchSimilarDocumentsAsync(string query, int limit = 5);
    }
} 