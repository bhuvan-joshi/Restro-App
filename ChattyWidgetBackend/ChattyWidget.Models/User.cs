using System.ComponentModel.DataAnnotations;

namespace ChattyWidget.Models;

public class User
{
    [Key]
    public Guid Id { get; set; }
    
    [Required]
    [MaxLength(100)]
    public string Username { get; set; } = string.Empty;
    
    [Required]
    [MaxLength(100)]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;
    
    // Hashed password - never store plain text passwords
    [Required]
    public string PasswordHash { get; set; } = string.Empty;
    
    [Required]
    [MaxLength(50)]
    public string Role { get; set; } = "user";  // Default role is "user", can be "superadmin" or other roles
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime? LastLoginAt { get; set; }
    
    // Navigation property
    public ICollection<Document> Documents { get; set; } = new List<Document>();
    public ICollection<ChatSession> ChatSessions { get; set; } = new List<ChatSession>();
    public ICollection<WidgetSettings> Widgets { get; set; } = new List<WidgetSettings>();
    
    // LLM preferences
    public UserLlmPreference LlmPreference { get; set; }
} 