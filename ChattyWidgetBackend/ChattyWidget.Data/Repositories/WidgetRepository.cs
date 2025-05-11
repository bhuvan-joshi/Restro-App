using ChattyWidget.Core.Interfaces;
using ChattyWidget.Models;
using Microsoft.EntityFrameworkCore;

namespace ChattyWidget.Data.Repositories;

public class WidgetRepository : IWidgetRepository
{
    private readonly ApplicationDbContext _context;

    public WidgetRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<WidgetSettings>> GetUserWidgetsAsync(Guid userId)
    {
        return await _context.WidgetSettings
            .Where(w => w.UserId == userId)
            .ToListAsync();
    }

    public async Task<WidgetSettings?> GetWidgetByIdAsync(Guid widgetId, Guid userId)
    {
        return await _context.WidgetSettings
            .FirstOrDefaultAsync(w => w.Id == widgetId && w.UserId == userId);
    }

    public async Task<WidgetSettings?> GetPublicWidgetByIdAsync(Guid widgetId)
    {
        return await _context.WidgetSettings
            .FirstOrDefaultAsync(w => w.Id == widgetId && w.IsActive);
    }

    public async Task AddWidgetAsync(WidgetSettings widget)
    {
        await _context.WidgetSettings.AddAsync(widget);
    }

    public async Task<bool> UpdateWidgetAsync(WidgetSettings widget)
    {
        var existingWidget = await _context.WidgetSettings
            .FirstOrDefaultAsync(w => w.Id == widget.Id && w.UserId == widget.UserId);
            
        if (existingWidget == null)
            return false;
            
        // Update widget properties
        existingWidget.BotName = widget.BotName;
        existingWidget.WelcomeMessage = widget.WelcomeMessage;
        existingWidget.PrimaryColor = widget.PrimaryColor;
        existingWidget.Position = widget.Position;
        existingWidget.ModelId = widget.ModelId;
        existingWidget.SiteName = widget.SiteName;
        existingWidget.SiteDescription = widget.SiteDescription;
        existingWidget.PrimaryContent = widget.PrimaryContent;
        existingWidget.CustomKnowledge = widget.CustomKnowledge;
        existingWidget.IsActive = widget.IsActive;
        existingWidget.AllowedDomains = widget.AllowedDomains;
        existingWidget.LogoUrl = widget.LogoUrl;
        existingWidget.CustomCSS = widget.CustomCSS;
        existingWidget.TrackingEnabled = widget.TrackingEnabled;
        existingWidget.UpdatedAt = widget.UpdatedAt;
        
        // Add behavior-specific fields
        existingWidget.IsOfflineMode = widget.IsOfflineMode;
        existingWidget.OfflineMessage = widget.OfflineMessage;
        existingWidget.ShowSources = widget.ShowSources;
        existingWidget.RequireEmailToStart = widget.RequireEmailToStart;
        existingWidget.CollectUserFeedback = widget.CollectUserFeedback;
        
        return true;
    }

    public async Task<bool> DeleteWidgetAsync(Guid widgetId, Guid userId)
    {
        var widget = await _context.WidgetSettings
            .FirstOrDefaultAsync(w => w.Id == widgetId && w.UserId == userId);
            
        if (widget == null)
            return false;
            
        _context.WidgetSettings.Remove(widget);
        return true;
    }

    public async Task SaveChangesAsync()
    {
        await _context.SaveChangesAsync();
    }
}