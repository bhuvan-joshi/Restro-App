using System.ComponentModel.DataAnnotations;

namespace ChattyWidget.Models;

public class ChatMessage
{
    [Key]
    public Guid Id { get; set; }
    
    [Required]
    public Guid SessionId { get; set; }
    
    public ChatSession Session { get; set; } = null!;
    
    [Required]
    public string Content { get; set; } = string.Empty;
    
    [Required]
    public bool IsFromUser { get; set; }
    
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    
    public string? ModelUsed { get; set; }
    
    public int? TokenCount { get; set; }
    
    // For tracking which documents were used to generate the response
    public string? SourceDocumentIds { get; set; }
} 