using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using ChattyWidget.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using DocModel = ChattyWidget.Models.Document;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using DocumentFormat.OpenXml.Spreadsheet;
using iText.Kernel.Pdf;
using iText.Kernel.Pdf.Canvas.Parser;
using iText.Kernel.Pdf.Canvas.Parser.Listener;
using ChattyWidget.Core.Interfaces;

namespace ChattyWidget.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DocumentsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<DocumentsController> _logger;
    private readonly IConfiguration _configuration;
    private readonly string _uploadDirectory;
    private readonly long _maxFileSize = 10 * 1024 * 1024; // 10 MB default
    private readonly string[] _allowedFileTypes = { ".pdf", ".docx", ".doc", ".txt", ".csv", ".md", ".json", ".xml", ".xlsx", ".xls" };
    private readonly IEmbeddingService _embeddingService;

    public DocumentsController(ApplicationDbContext context, ILogger<DocumentsController> logger, IConfiguration configuration, IEmbeddingService embeddingService)
    {
        _context = context;
        _logger = logger;
        _configuration = configuration;
        _embeddingService = embeddingService;
        
        // Get upload directory from configuration, or use a default
        _uploadDirectory = _configuration["FileStorage:UploadDirectory"] ?? Path.Combine(Path.GetTempPath(), "ChattyWidget", "Uploads");
        
        // Create the directory if it doesn't exist
        if (!Directory.Exists(_uploadDirectory))
        {
            Directory.CreateDirectory(_uploadDirectory);
        }
        
        // Get max file size from configuration if available
        if (long.TryParse(_configuration["FileStorage:MaxFileSizeMB"], out long configMaxSize))
        {
            _maxFileSize = configMaxSize * 1024 * 1024;
        }
    }
    
    // GET: api/documents
    [HttpGet]
    public async Task<ActionResult<Models.PaginatedResult<DocModel>>> GetDocuments(
        [FromQuery] int page = 1, 
        [FromQuery] int pageSize = 10, 
        [FromQuery] bool excludeContent = true)
    {
        try
        {
            // Validate pagination parameters
            if (page < 1) page = 1;
            if (pageSize < 1) pageSize = 10;
            if (pageSize > 100) pageSize = 100; // Maximum page size

            // Get the current user ID from claims
            if (!TryGetCurrentUserId(out Guid userId))
            {
                return Unauthorized("Invalid user ID");
            }

            _logger.LogInformation("GetDocuments called with page={Page}, pageSize={PageSize}, excludeContent={ExcludeContent}", 
                page, pageSize, excludeContent);

            // Create query for documents
            var query = _context.Documents
                .Where(d => d.UserId == userId);
                
            // Get total count for pagination
            var totalCount = await query.CountAsync();
            
            // Calculate total pages
            var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);
            
            // Select and paginate documents
            var documents = await query
                .OrderByDescending(d => d.UploadDate)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(d => new DocModel
                {
                    Id = d.Id,
                    Name = d.Name,
                    OriginalFileName = d.OriginalFileName,
                    ContentType = d.ContentType,
                    Size = d.Size,
                    UploadDate = d.UploadDate,
                    Status = d.Status,
                    FileUrl = d.FileUrl,
                    ErrorMessage = d.ErrorMessage,
                    UserId = d.UserId,
                    // Include content only if explicitly requested
                    Content = excludeContent ? null : d.Content
                })
                .ToListAsync();

            // Return paginated result
            var result = new Models.PaginatedResult<DocModel>
            {
                Items = documents,
                Page = page,
                PageSize = pageSize,
                TotalCount = totalCount,
                TotalPages = totalPages
            };

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving documents for user");
            return StatusCode(500, "An error occurred while retrieving documents");
        }
    }

    // GET: api/documents/5
    [HttpGet("{id}")]
    public async Task<ActionResult<DocModel>> GetDocument(Guid id)
    {
        try
        {
            // Get the current user ID from claims
            if (!TryGetCurrentUserId(out Guid userId))
            {
                return Unauthorized("Invalid user ID");
            }
            
            // Get the document, ensuring it belongs to the current user
            var document = await _context.Documents
                .Where(d => d.Id == id && d.UserId == userId)
                .FirstOrDefaultAsync();
            
            if (document == null)
            {
                return NotFound();
            }
            
            return document;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving document with ID: {DocumentId}", id);
            return StatusCode(500, "An error occurred while retrieving the document");
        }
    }
    
    // POST: api/documents
    [HttpPost]
    public async Task<ActionResult<DocModel>> CreateDocument(DocModel document)
    {
        // In a real app, you'd set the UserId from the authenticated user
        // document.UserId = User.GetUserId();
        
        _context.Documents.Add(document);
        await _context.SaveChangesAsync();
        
        return CreatedAtAction(nameof(GetDocument), new { id = document.Id }, document);
    }
    
    // POST: api/documents/upload
    [HttpPost("upload")]
    [RequestSizeLimit(20_000_000)] // 20 MB limit for the entire request
    public async Task<ActionResult<DocModel>> UploadDocument(IFormFile file)
    {
        _logger.LogInformation("UploadDocument called with file: {FileName}, size: {FileSize}KB", 
            file?.FileName ?? "null", 
            file?.Length / 1024 ?? 0);
        
        if (file == null || file.Length == 0)
        {
            _logger.LogWarning("No file was uploaded or file was empty");
            return BadRequest("No file was uploaded");
        }
        
        try
        {
            // Get the current user ID from claims
            if (!TryGetCurrentUserId(out Guid userId))
            {
                _logger.LogWarning("Failed to get user ID from claims");
                return Unauthorized("Invalid user ID");
            }
            
            _logger.LogInformation("Processing upload for user ID: {UserId}", userId);
            
            // Check file size
            if (file.Length > _maxFileSize)
            {
                _logger.LogWarning("File size {FileSize}KB exceeds max size {MaxSize}MB", 
                    file.Length / 1024, _maxFileSize / (1024 * 1024));
                return BadRequest($"File size exceeds the maximum allowed size of {_maxFileSize / (1024 * 1024)} MB");
            }
            
            // Check file extension
            string fileExtension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!_allowedFileTypes.Contains(fileExtension))
            {
                _logger.LogWarning("File type {FileType} is not supported", fileExtension);
                return BadRequest($"File type {fileExtension} is not supported. Allowed types: {string.Join(", ", _allowedFileTypes)}");
            }
            
            // Generate a unique ID for the document
            Guid documentId = Guid.NewGuid();
            
            // Create a sanitized filename
            string sanitizedFileName = SanitizeFileName(file.FileName);
            string uniqueFileName = $"{documentId}_{sanitizedFileName}";
            
            // Create user-specific directory
            string userUploadDirectory = Path.Combine(_uploadDirectory, userId.ToString());
            if (!Directory.Exists(userUploadDirectory))
            {
                _logger.LogInformation("Creating user upload directory: {Directory}", userUploadDirectory);
                Directory.CreateDirectory(userUploadDirectory);
            }
            
            string filePath = Path.Combine(userUploadDirectory, uniqueFileName);
            
            _logger.LogInformation("Saving file to: {FilePath}", filePath);
            
            // Save the file to disk
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }
            
            // Extract text content based on file type
            string content = await ExtractTextContent(file, filePath);
            
            // Create the document entity
            var document = new DocModel
            {
                Id = documentId,
                UserId = userId,
                Name = sanitizedFileName,
                OriginalFileName = file.FileName, // Store the original file name
                ContentType = file.ContentType, // Store the content type
                Type = fileExtension.TrimStart('.'),
                Size = file.Length,
                Content = content, // Store extracted text in Content field
                UploadDate = DateTime.UtcNow,
                Status = "indexed", // Mark as indexed for now
                FileUrl = filePath, // Store the file path
                Embeddings = null, // Initialize the new fields we added
                Metadata = null
            };
            
            _logger.LogInformation("Adding document to database with ID: {DocumentId}", documentId);
            
            _context.Documents.Add(document);
            await _context.SaveChangesAsync();
            
            _logger.LogInformation("Document successfully saved with ID: {DocumentId}", documentId);
            
            // Process embeddings in the background
            _ = Task.Run(async () => 
            {
                try 
                {
                    await _embeddingService.ProcessDocumentAsync(documentId);
                    _logger.LogInformation($"Successfully processed embeddings for document {documentId}");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Error processing embeddings for document {documentId}");
                }
            });
            
            return CreatedAtAction(nameof(GetDocument), new { id = document.Id }, document);
        }
        catch (IOException ioEx)
        {
            _logger.LogError(ioEx, "File system error while uploading document: {FileName}", file.FileName);
            return StatusCode(500, $"File system error: {ioEx.Message}");
        }
        catch (DbUpdateException dbEx)
        {
            _logger.LogError(dbEx, "Database error while saving document: {FileName}", file.FileName);
            return StatusCode(500, $"Database error: {dbEx.Message}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error uploading document: {FileName}", file.FileName);
            return StatusCode(500, $"An error occurred while uploading the document: {ex.Message}");
        }
    }
    
    // PUT: api/documents/5
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateDocument(Guid id, DocModel document)
    {
        if (id != document.Id)
        {
            return BadRequest();
        }
        
        _context.Entry(document).State = EntityState.Modified;
        
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!DocumentExists(id))
            {
                return NotFound();
            }
            else
            {
                throw;
            }
        }
        
        return NoContent();
    }
    
    // DELETE: api/documents/5
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteDocument(Guid id)
    {
        try
        {
            // Get the current user ID from claims
            if (!TryGetCurrentUserId(out Guid userId))
            {
                return Unauthorized("Invalid user ID");
            }
            
            // Get the document, ensuring it belongs to the current user
            var document = await _context.Documents
                .Where(d => d.Id == id && d.UserId == userId)
                .FirstOrDefaultAsync();
            
            if (document == null)
            {
                return NotFound();
            }
            
            // Delete the file from disk if it exists
            if (!string.IsNullOrEmpty(document.FileUrl) && System.IO.File.Exists(document.FileUrl))
            {
                try
                {
                    System.IO.File.Delete(document.FileUrl);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to delete file: {FilePath}", document.FileUrl);
                }
            }
            
            // Remove from database
            _context.Documents.Remove(document);
            await _context.SaveChangesAsync();
            
            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting document with ID: {DocumentId}", id);
            return StatusCode(500, "An error occurred while deleting the document");
        }
    }
    
    // GET: api/documents/5/download
    [HttpGet("{id}/download")]
    public async Task<IActionResult> DownloadDocument(Guid id)
    {
        try
        {
            // Get the current user ID from claims
            if (!TryGetCurrentUserId(out Guid userId))
            {
                _logger.LogWarning("Unauthorized download attempt with invalid user ID for document: {DocumentId}", id);
                return Unauthorized("Invalid user ID");
            }
            
            _logger.LogInformation("Attempting to download document {DocumentId} for user {UserId}", id, userId);
            
            // Get the document, ensuring it belongs to the current user
            var document = await _context.Documents
                .Where(d => d.Id == id && d.UserId == userId)
                .FirstOrDefaultAsync();
            
            if (document == null)
            {
                _logger.LogWarning("Document not found: {DocumentId} for user {UserId}", id, userId);
                return NotFound();
            }
            
            _logger.LogInformation("Found document: {DocumentName}, FileUrl: {FileUrl}", document.Name, document.FileUrl);
            
            // Determine content type first - we'll need it either way
            string contentType = GetContentType(document.Type ?? document.ContentType ?? "txt");
            _logger.LogInformation("Content type determined as: {ContentType}", contentType);
            
            // First try: FileUrl path
            if (!string.IsNullOrEmpty(document.FileUrl) && System.IO.File.Exists(document.FileUrl))
            {
                _logger.LogInformation("Serving document from file: {FileUrl}", document.FileUrl);
                var fileStream = new FileStream(document.FileUrl, FileMode.Open, FileAccess.Read);
                return new FileStreamResult(fileStream, contentType)
                {
                    FileDownloadName = document.Name
                };
            }
            
            // Fallback: Content property if file doesn't exist
            if (!string.IsNullOrEmpty(document.Content))
            {
                _logger.LogInformation("Serving document from Content property for {DocumentId}", id);
                byte[] bytes = Encoding.UTF8.GetBytes(document.Content);
                return File(bytes, contentType, document.Name);
            }
            
            // If we got here, we couldn't find any content to serve
            _logger.LogWarning("No content available for document: {DocumentId}", id);
            return NotFound("Document content not found");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error downloading document with ID: {DocumentId}", id);
            return StatusCode(500, $"An error occurred while downloading the document: {ex.Message}");
        }
    }
    
    // POST: api/documents/reprocess
    [HttpPost("reprocess")]
    public async Task<IActionResult> ReprocessDocuments([FromQuery] bool all = false, [FromBody] List<string> documentIds = null)
    {
        try
        {
            // Get the current user ID from claims
            if (!TryGetCurrentUserId(out Guid userId))
            {
                return Unauthorized("Invalid user ID");
            }
            
            _logger.LogInformation("Reprocessing documents for user {UserId}, all={All}, specificDocuments={Count}", 
                userId, all, documentIds?.Count ?? 0);
                
            var query = _context.Documents
                .Where(d => d.UserId == userId)
                .AsNoTracking(); // Use AsNoTracking for the query to avoid tracking issues
            
            // If not processing all documents, filter by the provided document IDs
            if (!all && documentIds != null && documentIds.Count > 0)
            {
                var guidIds = documentIds.Select(id => Guid.TryParse(id, out Guid guid) ? guid : Guid.Empty)
                    .Where(id => id != Guid.Empty)
                    .ToList();
                    
                query = query.Where(d => guidIds.Contains(d.Id));
            }
            
            // Use projection to avoid the SqlNullValueException when reading directly
            var docIdsToProcess = await query.Select(d => d.Id).ToListAsync();
            
            _logger.LogInformation("Found {Count} documents to reprocess", docIdsToProcess.Count);
            
            // Only process the first document immediately, return info about the rest
            int totalToProcess = docIdsToProcess.Count;
            Guid? processedId = null;
            string processedName = null;
            
            if (docIdsToProcess.Count > 0)
            {
                var docId = docIdsToProcess[0];
                var document = await _context.Documents.FindAsync(docId);
                
                if (document != null)
                {
                    // Reset the embedding processing status
                    document.IsEmbeddingProcessed = false;
                    document.EmbeddingVector = null; // Ensure it's null to avoid any issues
                    await _context.SaveChangesAsync();
                    
                    // Process embeddings for the first document
                    await _embeddingService.ProcessDocumentAsync(docId);
                    processedId = docId;
                    processedName = document.Name;
                    
                    _logger.LogInformation("Reprocessed document {DocumentId} - {DocumentName}", docId, document.Name);
                }
                
                // Queue the remaining documents to be processed in the background
                if (docIdsToProcess.Count > 1)
                {
                    // Process the remaining documents as a background task
                    _ = Task.Run(async () => 
                    {
                        try
                        {
                            for (int i = 1; i < docIdsToProcess.Count; i++)
                            {
                                var nextDocId = docIdsToProcess[i];
                                
                                using (var scope = _logger.BeginScope("Background Processing Document {DocumentId}", nextDocId))
                                {
                                    try
                                    {
                                        // Use a new context instance for each document
                                        using (var dbContext = new ApplicationDbContext(
                                            new DbContextOptionsBuilder<ApplicationDbContext>()
                                                .UseSqlServer(_context.Database.GetConnectionString())
                                                .Options))
                                        {
                                            var nextDoc = await dbContext.Documents.FindAsync(nextDocId);
                                            if (nextDoc == null) continue;
                                            
                                            // Reset processing status
                                            nextDoc.IsEmbeddingProcessed = false;
                                            nextDoc.EmbeddingVector = null;
                                            await dbContext.SaveChangesAsync();
                                            
                                            // Process embeddings
                                            await _embeddingService.ProcessDocumentAsync(nextDocId);
                                            
                                            _logger.LogInformation("Background processed document {DocumentId} - {DocumentName} ({Current}/{Total})", 
                                                nextDocId, nextDoc.Name, i + 1, docIdsToProcess.Count);
                                        }
                                    }
                                    catch (Exception ex)
                                    {
                                        _logger.LogError(ex, "Error processing document {DocumentId} in background", nextDocId);
                                    }
                                }
                                
                                // Add a small delay to prevent overloading Ollama
                                await Task.Delay(500);
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Background document processing failed");
                        }
                    });
                }
            }
            
            // Return info about what we're doing
            return Ok(new { 
                message = $"Processing {totalToProcess} documents. First document completed: {(processedName ?? "None")}", 
                processedCount = processedId != null ? 1 : 0,
                totalToProcess = totalToProcess,
                processedId = processedId,
                remainingCount = Math.Max(0, totalToProcess - 1),
                isProcessingRemaining = totalToProcess > 1
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reprocessing documents");
            return StatusCode(500, "An error occurred while reprocessing documents");
        }
    }
    
    // POST: api/documents/{id}/reprocess
    [HttpPost("{id}/reprocess")]
    public async Task<IActionResult> ReprocessDocument(Guid id)
    {
        try
        {
            // Get the current user ID from claims
            if (!TryGetCurrentUserId(out Guid userId))
            {
                return Unauthorized("Invalid user ID");
            }
            
            // Get the document, ensuring it belongs to the current user
            var document = await _context.Documents
                .FirstOrDefaultAsync(d => d.Id == id && d.UserId == userId);
            
            if (document == null)
            {
                return NotFound("Document not found");
            }
            
            _logger.LogInformation("Reprocessing document {DocumentId} - {DocumentName}", id, document.Name);
            
            // Clear existing chunks for this document
            var existingChunks = await _context.DocumentChunks
                .Where(c => c.DocumentId == id)
                .ToListAsync();
                
            if (existingChunks.Any())
            {
                _context.DocumentChunks.RemoveRange(existingChunks);
                await _context.SaveChangesAsync();
                _logger.LogInformation("Removed {Count} existing chunks for document {DocumentId}", 
                    existingChunks.Count, id);
            }
            
            // Reset the embedding processed flag
            document.IsEmbeddingProcessed = false;
            document.EmbeddingVector = null; // Ensure it's null to avoid any issues
            await _context.SaveChangesAsync();
            
            // Process embeddings
            await _embeddingService.ProcessDocumentAsync(id);
            
            return Ok(new { message = $"Successfully reprocessed document: {document.Name}" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reprocessing document {DocumentId}", id);
            return StatusCode(500, $"An error occurred while reprocessing the document: {ex.Message}");
        }
    }
    
    private bool TryGetCurrentUserId(out Guid userId)
    {
        userId = Guid.Empty;
        
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out userId))
        {
            return false;
        }
        
        return true;
    }
    
    private string SanitizeFileName(string fileName)
    {
        // Replace invalid characters with underscore
        string invalidChars = Regex.Escape(new string(Path.GetInvalidFileNameChars()));
        string invalidReStr = string.Format(@"[{0}]", invalidChars);
        
        return Regex.Replace(fileName, invalidReStr, "_");
    }
    
    private async Task<string> ExtractTextContent(IFormFile file, string filePath)
    {
        try
        {
            string fileExtension = Path.GetExtension(file.FileName).ToLowerInvariant();
            
            // Handle text files directly
            if (fileExtension == ".txt" || fileExtension == ".md" || fileExtension == ".json" || fileExtension == ".xml")
            {
                using (var reader = new StreamReader(file.OpenReadStream()))
                {
                    return await reader.ReadToEndAsync();
                }
            }
            // Handle PDF files
            else if (fileExtension == ".pdf")
            {
                StringBuilder text = new StringBuilder();
                
                using (PdfReader reader = new PdfReader(filePath))
                using (PdfDocument pdfDoc = new PdfDocument(reader))
                {
                    for (int i = 1; i <= pdfDoc.GetNumberOfPages(); i++)
                    {
                        ITextExtractionStrategy strategy = new SimpleTextExtractionStrategy();
                        string pageText = PdfTextExtractor.GetTextFromPage(pdfDoc.GetPage(i), strategy);
                        text.AppendLine(pageText);
                    }
                }
                
                return text.ToString();
            }
            // Handle Word documents (DOCX)
            else if (fileExtension == ".docx")
            {
                StringBuilder text = new StringBuilder();
                
                using (WordprocessingDocument doc = WordprocessingDocument.Open(filePath, false))
                {
                    if (doc.MainDocumentPart != null && doc.MainDocumentPart.Document != null && 
                        doc.MainDocumentPart.Document.Body != null)
                    {
                        // Extract text from the main document
                        var paragraphs = doc.MainDocumentPart.Document.Body.Elements<Paragraph>();
                        foreach (var paragraph in paragraphs)
                        {
                            text.AppendLine(paragraph.InnerText);
                        }
                    }
                }
                
                return text.ToString();
            }
            // Handle Excel files (XLSX and XLS)
            else if (fileExtension == ".xlsx" || fileExtension == ".xls")
            {
                try
                {
                    using (SpreadsheetDocument spreadsheetDocument = SpreadsheetDocument.Open(filePath, false))
                    {
                        var extractedText = ExtractTextFromExcel(spreadsheetDocument);
                        return extractedText;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error extracting text from Excel file: {FileName}", file.FileName);
                    return $"Error extracting Excel content: {ex.Message}";
                }
            }
            
            // For other file types or if extraction fails, return a placeholder
            return $"Content extraction not implemented for file type {fileExtension}.";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error extracting text from document: {FileName}", file.FileName);
            return $"Error extracting content from {file.FileName}: {ex.Message}";
        }
    }
    
    private string ExtractTextFromExcel(SpreadsheetDocument spreadsheetDocument)
    {
        StringBuilder text = new StringBuilder();
        WorkbookPart workbookPart = spreadsheetDocument.WorkbookPart;
        
        if (workbookPart != null)
        {
            SharedStringTablePart stringTablePart = workbookPart.GetPartsOfType<SharedStringTablePart>().FirstOrDefault();
            
            foreach (Sheet sheet in workbookPart.Workbook.Descendants<Sheet>())
            {
                text.AppendLine($"Sheet: {sheet.Name}");
                text.AppendLine("----------------------------------------");
                
                WorksheetPart worksheetPart = (WorksheetPart)workbookPart.GetPartById(sheet.Id);
                if (worksheetPart != null)
                {
                    // Get all rows
                    var rows = worksheetPart.Worksheet.Descendants<Row>().ToList();
                    if (!rows.Any()) continue;
                    
                    // Get column headers (first row)
                    var headerRow = rows.First();
                    var headers = new List<string>();
                    foreach (Cell cell in headerRow.Elements<Cell>())
                    {
                        string headerValue = GetCellValue(cell, stringTablePart);
                        headers.Add(headerValue);
                    }

                    // Create a table structure
                    text.AppendLine("Table Structure:");
                    text.AppendLine(string.Join("\t", headers));
                    text.AppendLine("----------------------------------------");

                    // Process data rows with explicit headers
                    foreach (Row row in rows.Skip(1))
                    {
                        var rowDict = new Dictionary<string, string>();
                        int currentCell = 0;
                        
                        // Process cells with header context
                        foreach (Cell cell in row.Elements<Cell>())
                        {
                            // Handle empty cells by tracking column position
                            while (currentCell < headers.Count && 
                                   GetColumnIndexFromReference(cell.CellReference) > currentCell)
                            {
                                if (currentCell < headers.Count)
                                {
                                    rowDict[headers[currentCell]] = "";
                                }
                                currentCell++;
                            }
                            
                            if (currentCell < headers.Count)
                            {
                                string cellValue = GetCellValue(cell, stringTablePart);
                                rowDict[headers[currentCell]] = cellValue;
                            }
                            currentCell++;
                        }
                        
                        // Fill remaining empty cells
                        while (currentCell < headers.Count)
                        {
                            rowDict[headers[currentCell]] = "";
                            currentCell++;
                        }
                        
                        // First output row in header:value format for easier parsing
                        foreach (var header in headers)
                        {
                            if (rowDict.TryGetValue(header, out string value) && !string.IsNullOrEmpty(value))
                            {
                                text.AppendLine($"{header}: {value}");
                            }
                        }
                        
                        // Then output row in tab-delimited format for reference
                        text.AppendLine($"ROW_DATA: {string.Join("\t", headers.Select(h => rowDict.TryGetValue(h, out string v) ? v : ""))}");
                        text.AppendLine("----------------------------------------");
                    }
                    
                    // Add a summary of key columns for easier identification (especially useful for employee data)
                    text.AppendLine("\nKey Columns Summary:");
                    foreach (var header in headers)
                    {
                        // Check if this might be a name column
                        if (header.Contains("Name", StringComparison.OrdinalIgnoreCase) || 
                            header.Contains("Employee", StringComparison.OrdinalIgnoreCase) ||
                            header.Contains("Staff", StringComparison.OrdinalIgnoreCase) ||
                            header.Contains("Personnel", StringComparison.OrdinalIgnoreCase))
                        {
                            text.AppendLine($"Potential Employee Names: {header}");
                        }
                        // Check if this might be hours/time column
                        else if (header.Contains("Hour", StringComparison.OrdinalIgnoreCase) || 
                                 header.Contains("Time", StringComparison.OrdinalIgnoreCase) ||
                                 header.Contains("Duration", StringComparison.OrdinalIgnoreCase))
                        {
                            text.AppendLine($"Potential Hours Data: {header}");
                        }
                    }
                }
                text.AppendLine("\n");
            }
        }
        return text.ToString();
    }
    
    private string GetCellValue(Cell cell, SharedStringTablePart stringTablePart)
    {
        if (cell.CellValue == null) return string.Empty;
        
        string value = cell.CellValue.Text;
        
        // Handle different cell types
        if (cell.DataType != null)
        {
            if (cell.DataType.Value == CellValues.SharedString)
            {
                if (stringTablePart != null)
                {
                    return stringTablePart.SharedStringTable.ElementAt(int.Parse(value)).InnerText;
                }
            }
            else if (cell.DataType.Value == CellValues.Boolean)
            {
                return value == "1" ? "True" : "False";
            }
            else if (cell.DataType.Value == CellValues.Date)
            {
                try
                {
                    // Convert Excel date number to DateTime
                    if (double.TryParse(value, out double dateNum))
                    {
                        return DateTime.FromOADate(dateNum).ToString("yyyy-MM-dd");
                    }
                }
                catch { }
            }
        }
        
        return value;
    }
    
    private int GetColumnIndexFromReference(string cellReference)
    {
        // Convert column reference (e.g., "A", "B", "AA") to zero-based index
        if (string.IsNullOrEmpty(cellReference)) return 0;
        
        string columnReference = new string(cellReference.TakeWhile(c => !char.IsDigit(c)).ToArray());
        int index = 0;
        
        foreach (char c in columnReference)
        {
            index = index * 26 + (c - 'A' + 1);
        }
        
        return index - 1;
    }
    
    private string GetContentType(string fileType)
    {
        if (string.IsNullOrEmpty(fileType))
        {
            return "application/octet-stream";
        }
        
        return fileType.ToLower() switch
        {
            "pdf" => "application/pdf",
            "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "doc" => "application/msword",
            "txt" => "text/plain",
            "csv" => "text/csv",
            "json" => "application/json",
            "xml" => "application/xml",
            "md" => "text/markdown",
            "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "xls" => "application/vnd.ms-excel",
            _ => "application/octet-stream"
        };
    }
    
    private bool DocumentExists(Guid id)
    {
        return _context.Documents.Any(e => e.Id == id);
    }
}