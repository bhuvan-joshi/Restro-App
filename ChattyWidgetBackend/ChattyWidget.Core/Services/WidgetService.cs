using ChattyWidget.Core.Interfaces;
using ChattyWidget.Models;
using Microsoft.EntityFrameworkCore;

namespace ChattyWidget.Core.Services;

public class WidgetService
{
    private readonly IWidgetRepository _widgetRepository;

    public WidgetService(IWidgetRepository widgetRepository)
    {
        _widgetRepository = widgetRepository;
    }

    public async Task<List<WidgetSettings>> GetUserWidgetsAsync(Guid userId)
    {
        return await _widgetRepository.GetUserWidgetsAsync(userId);
    }

    public async Task<WidgetSettings?> GetWidgetByIdAsync(Guid widgetId, Guid userId)
    {
        return await _widgetRepository.GetWidgetByIdAsync(widgetId, userId);
    }

    public async Task<WidgetSettings?> GetPublicWidgetByIdAsync(Guid widgetId)
    {
        return await _widgetRepository.GetPublicWidgetByIdAsync(widgetId);
    }

    public async Task<WidgetSettings> CreateWidgetAsync(WidgetSettings widget)
    {
        widget.Id = Guid.NewGuid();
        widget.CreatedAt = DateTime.UtcNow;
        
        await _widgetRepository.AddWidgetAsync(widget);
        await _widgetRepository.SaveChangesAsync();
        
        return widget;
    }

    public async Task<WidgetSettings?> UpdateWidgetAsync(WidgetSettings widget)
    {
        widget.UpdatedAt = DateTime.UtcNow;
        
        if (await _widgetRepository.UpdateWidgetAsync(widget))
        {
            await _widgetRepository.SaveChangesAsync();
            return widget;
        }
        
        return null;
    }

    public async Task<bool> DeleteWidgetAsync(Guid widgetId, Guid userId)
    {
        if (await _widgetRepository.DeleteWidgetAsync(widgetId, userId))
        {
            await _widgetRepository.SaveChangesAsync();
            return true;
        }
        
        return false;
    }
} 