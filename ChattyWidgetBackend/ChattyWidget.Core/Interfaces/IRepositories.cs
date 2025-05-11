using ChattyWidget.Models;

namespace ChattyWidget.Core.Interfaces;

public interface IUserRepository
{
    Task<User?> GetUserByEmailAsync(string email);
    Task<User?> GetUserByIdAsync(Guid userId);
    Task<bool> IsEmailRegisteredAsync(string email);
    Task AddUserAsync(User user);
    Task SaveChangesAsync();
}

public interface IWidgetRepository
{
    Task<List<WidgetSettings>> GetUserWidgetsAsync(Guid userId);
    Task<WidgetSettings?> GetWidgetByIdAsync(Guid widgetId, Guid userId);
    Task<WidgetSettings?> GetPublicWidgetByIdAsync(Guid widgetId);
    Task AddWidgetAsync(WidgetSettings widget);
    Task<bool> UpdateWidgetAsync(WidgetSettings widget);
    Task<bool> DeleteWidgetAsync(Guid widgetId, Guid userId);
    Task SaveChangesAsync();
} 