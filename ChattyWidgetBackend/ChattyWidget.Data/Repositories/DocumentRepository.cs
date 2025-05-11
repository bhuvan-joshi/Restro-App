using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using ChattyWidget.Core.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using DocModel = ChattyWidget.Models.Document;

namespace ChattyWidget.Data.Repositories
{
    public class DocumentRepository : IDocumentRepository
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<DocumentRepository> _logger;

        public DocumentRepository(ApplicationDbContext context, ILogger<DocumentRepository> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<List<DocModel>> GetDocumentsByUserIdAsync(Guid userId)
        {
            try
            {
                _logger.LogInformation($"Getting documents for user ID: {userId}");
                
                // Query the actual database for documents
                return await _context.Documents
                    .Where(d => d.UserId == userId)
                    .OrderByDescending(d => d.UploadDate)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting documents for user ID: {userId}");
                throw;
            }
        }

        public async Task<DocModel> GetDocumentByIdAsync(Guid documentId)
        {
            try
            {
                _logger.LogInformation($"Getting document with ID: {documentId}");
                
                // Query the actual database for the document
                return await _context.Documents
                    .FirstOrDefaultAsync(d => d.Id == documentId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting document with ID: {documentId}");
                throw;
            }
        }

        public async Task<List<DocModel>> GetRelevantDocumentsForQueryAsync(Guid userId, string query)
        {
            try
            {
                _logger.LogInformation($"Getting relevant documents for query: {query}, user ID: {userId}");
                
                // Query the database for relevant documents
                var relevantDocuments = await _context.Documents
                    .Where(d => d.UserId == userId)
                    .Where(d => 
                        (d.Name != null && EF.Functions.Like(d.Name, $"%{query}%")) ||
                        (d.Content != null && EF.Functions.Like(d.Content, $"%{query}%")))
                    .OrderByDescending(d => d.UploadDate)
                    .ToListAsync();
                
                _logger.LogInformation($"Found {relevantDocuments.Count} relevant documents for query: {query}");
                
                return relevantDocuments;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting relevant documents for query: {query}, user ID: {userId}");
                throw;
            }
        }

        public async Task UpdateDocumentAsync(DocModel document)
        {
            try
            {
                _logger.LogInformation($"Updating document with ID: {document.Id}");
                
                _context.Documents.Update(document);
                await _context.SaveChangesAsync();
                
                _logger.LogInformation($"Successfully updated document with ID: {document.Id}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error updating document with ID: {document.Id}");
                throw;
            }
        }
    }
}
