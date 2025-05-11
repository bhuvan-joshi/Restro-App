using System.ComponentModel.DataAnnotations;

namespace ChattyWidget.Models;

public class WidgetSettingsDto
{
    public Guid? Id { get; set; }
    
    [Required]
    public Guid UserId { get; set; }
    
    [Required]
    [MaxLength(100)]
    public string BotName { get; set; } = "AI Assistant";
    
    [MaxLength(500)]
    public string WelcomeMessage { get; set; } = "Hello! How can I help you today?";
    
    public string PrimaryColor { get; set; } = "#3498db";
    
    [MaxLength(20)]
    public string Position { get; set; } = "bottom-right";
    
    public string? ModelId { get; set; }
    
    // Site context information
    [MaxLength(100)]
    public string? SiteName { get; set; }
    
    [MaxLength(500)]
    public string? SiteDescription { get; set; }
    
    public string? PrimaryContent { get; set; }
    
    public string? CustomKnowledge { get; set; }
    
    // Widget visibility settings
    public bool IsActive { get; set; } = true;
    
    public string AllowedDomains { get; set; } = "*";
    
    // Design settings
    public string? LogoUrl { get; set; }
    
    public string? CustomCSS { get; set; }
    
    // Analytics
    public bool TrackingEnabled { get; set; } = true;
    
    // Behavior settings
    public bool IsOfflineMode { get; set; } = false;
    
    [MaxLength(500)]
    public string? OfflineMessage { get; set; } = "Sorry, we're currently offline. Please leave a message and we'll get back to you soon.";
    
    public bool ShowSources { get; set; } = true;
    
    public bool RequireEmailToStart { get; set; } = false;
    
    public bool CollectUserFeedback { get; set; } = false;
}