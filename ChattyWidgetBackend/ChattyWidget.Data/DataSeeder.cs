using ChattyWidget.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Security.Cryptography;
using System.Text;
using BCrypt.Net;

namespace ChattyWidget.Data;

public class DataSeeder
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<DataSeeder> _logger;

    public DataSeeder(ApplicationDbContext context, ILogger<DataSeeder> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task SeedDataAsync()
    {
        try
        {
            // Only seed if the database is newly created
            if (!await _context.Users.AnyAsync())
            {
                await SeedUsersAsync();
                await SeedWidgetsAsync();
                await _context.SaveChangesAsync();
                
                _logger.LogInformation("Database seeded successfully");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error seeding database");
        }
    }

    private async Task SeedUsersAsync()
    {
        // Create super admin user
        var superAdmin = new User
        {
            Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
            Username = "admin",
            Email = "admin@example.com",
            // Hash password "Admin123!" - in production, use a secure password generator
            PasswordHash = HashPassword("Admin123!"),
            Role = "superadmin",
            CreatedAt = DateTime.UtcNow,
            LastLoginAt = null
        };

        await _context.Users.AddAsync(superAdmin);
        _logger.LogInformation("Super admin user created");
    }

    private async Task SeedWidgetsAsync()
    {
        var adminId = Guid.Parse("00000000-0000-0000-0000-000000000001");
        
        // Create a default widget
        var defaultWidget = new WidgetSettings
        {
            Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
            UserId = adminId,
            BotName = "ChattyBot",
            SiteName = "Default Chat Widget",
            SiteDescription = "A default chat widget configuration",
            PrimaryColor = "#3b82f6",
            Position = "bottom-right",
            WelcomeMessage = "Hello! How can I help you today?",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            ModelId = "gpt-3.5-turbo", // Default model
            CustomCSS = null
        };

        await _context.WidgetSettings.AddAsync(defaultWidget);
        _logger.LogInformation("Default widget created");
    }

    private string HashPassword(string password)
    {
        // Use BCrypt for password hashing
        return BCrypt.Net.BCrypt.HashPassword(password);
    }
} 