using ChattyWidget.Core.Models;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace ChattyWidget.Core.Interfaces
{
    public interface IDocumentService
    {
        Task<Document> GetDocumentAsync(string id);
        Task<Document> GetDocumentByIdAsync(Guid id);
        Task<List<Document>> SearchDocumentsAsync(string query);
        Task<byte[]> GetDocumentContentAsync(string id);
        // This method extracts content from documents and stores it in the Content field
        Task<string> ExtractContentAsync(string id);
    }
}
