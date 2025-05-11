using System.ComponentModel.DataAnnotations;

namespace ChattyWidget.Models;

public class ChatSession
{
    [Key]
    public Guid Id { get; set; }
    
    [Required]
    public Guid UserId { get; set; }
    
    public User User { get; set; } = null!;
    
    [Required]
    public Guid WidgetId { get; set; }
    
    public WidgetSettings Widget { get; set; } = null!;
    
    public string SessionIdentifier { get; set; } = string.Empty;
    
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime? EndedAt { get; set; }
    
    public string? UserLocation { get; set; }
    
    public string? UserDevice { get; set; }
    
    public string? ReferrerUrl { get; set; }
    
    // Navigation property
    public ICollection<ChatMessage> Messages { get; set; } = new List<ChatMessage>();
} 