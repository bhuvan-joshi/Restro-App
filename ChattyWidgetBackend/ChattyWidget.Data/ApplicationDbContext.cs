using ChattyWidget.Models;
using Microsoft.EntityFrameworkCore;

namespace ChattyWidget.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }
    
    public DbSet<User> Users { get; set; } = null!;
    public DbSet<Document> Documents { get; set; } = null!;
    public DbSet<ChatSession> ChatSessions { get; set; } = null!;
    public DbSet<ChatMessage> ChatMessages { get; set; } = null!;
    public DbSet<WidgetSettings> WidgetSettings { get; set; } = null!;
    public DbSet<UserLlmPreference> UserLlmPreferences { get; set; } = null!;
    public DbSet<DocumentChunk> DocumentChunks { get; set; }
    
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        
        // Configure relationships
        modelBuilder.Entity<Document>()
            .HasOne(d => d.User)
            .WithMany(u => u.Documents)
            .HasForeignKey(d => d.UserId)
            .OnDelete(DeleteBehavior.Cascade);
            
        modelBuilder.Entity<ChatSession>()
            .HasOne(s => s.User)
            .WithMany(u => u.ChatSessions)
            .HasForeignKey(s => s.UserId)
            .OnDelete(DeleteBehavior.Cascade);
            
        modelBuilder.Entity<ChatSession>()
            .HasOne(s => s.Widget)
            .WithMany(w => w.ChatSessions)
            .HasForeignKey(s => s.WidgetId)
            .OnDelete(DeleteBehavior.Restrict);
            
        modelBuilder.Entity<ChatMessage>()
            .HasOne(m => m.Session)
            .WithMany(s => s.Messages)
            .HasForeignKey(m => m.SessionId)
            .OnDelete(DeleteBehavior.Cascade);
            
        modelBuilder.Entity<WidgetSettings>()
            .HasOne(w => w.User)
            .WithMany(u => u.Widgets)
            .HasForeignKey(w => w.UserId)
            .OnDelete(DeleteBehavior.Cascade);
            
        modelBuilder.Entity<UserLlmPreference>()
            .HasOne(p => p.User)
            .WithOne(u => u.LlmPreference)
            .HasForeignKey<UserLlmPreference>(p => p.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
} 