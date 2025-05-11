using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace ChattyWidget.Models;

// Document model
public class Document
{
    [Key]
    public Guid Id { get; set; }
    
    [Required]
    public Guid UserId { get; set; }
    
    [ForeignKey("UserId")]
    [JsonIgnore]
    public User User { get; set; } = null!;
    
    [Required]
    [MaxLength(255)]
    public string Name { get; set; } = string.Empty;
    
    [MaxLength(50)]
    public string Type { get; set; } = string.Empty;
    
    public long Size { get; set; }
    
    public string? Content { get; set; }
    
    // Extracted text content from the document
    // TODO: This field doesn't exist in the database schema yet
    // public string? TextContent { get; set; }
    
    public DateTime UploadDate { get; set; } = DateTime.UtcNow;
    
    [MaxLength(50)]
    public string Status { get; set; } = "processing";
    
    // File path or URL
    [MaxLength(500)]
    public string? FileUrl { get; set; }
    
    // For error messages
    [MaxLength(500)]
    public string? ErrorMessage { get; set; }
    
    // For vector embeddings (stored as JSON array of floats)
    public string? Embeddings { get; set; }
    
    // Metadata from document (title, author, etc.)
    public string? Metadata { get; set; }
    
    // Original file name before sanitization
    [MaxLength(500)]
    public string? OriginalFileName { get; set; }
    
    // Content MIME type
    [MaxLength(100)]
    public string? ContentType { get; set; }

    // Store document-level embedding as JSON string
    public string? EmbeddingVector { get; set; }

    // Flag to track if document has been processed for embeddings
    public bool IsEmbeddingProcessed { get; set; } = false;

    // Navigation property for document chunks
    public ICollection<DocumentChunk> Chunks { get; set; } = new List<DocumentChunk>();
}
