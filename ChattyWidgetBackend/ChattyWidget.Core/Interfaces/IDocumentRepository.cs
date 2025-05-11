using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using DocModel = ChattyWidget.Models.Document;

namespace ChattyWidget.Core.Interfaces;

/// <summary>
/// Interface for document repository operations
/// </summary>
public interface IDocumentRepository
{
    /// <summary>
    /// Gets all documents for a user
    /// </summary>
    Task<List<DocModel>> GetDocumentsByUserIdAsync(Guid userId);
    
    /// <summary>
    /// Gets a document by its ID
    /// </summary>
    Task<DocModel> GetDocumentByIdAsync(Guid id);
    
    /// <summary>
    /// Gets documents relevant to a query based on content similarity
    /// </summary>
    Task<List<DocModel>> GetRelevantDocumentsForQueryAsync(Guid userId, string query);

    Task UpdateDocumentAsync(DocModel document);
}
