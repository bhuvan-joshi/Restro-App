using ChattyWidget.Models;

namespace ChattyWidget.Core.Interfaces;

public interface IChatSessionRepository
{
    Task<List<ChatSession>> GetUserSessionsAsync(Guid userId);
    Task<List<ChatSession>> GetWidgetSessionsAsync(Guid widgetId);
    Task<ChatSession?> GetSessionByIdAsync(Guid sessionId);
    Task<ChatSession> CreateSessionAsync(ChatSession session);
    Task UpdateSessionAsync(ChatSession session);
    Task SaveChangesAsync();
}

public interface IChatMessageRepository
{
    Task<List<ChatMessage>> GetSessionMessagesAsync(Guid sessionId);
    Task<ChatMessage?> GetMessageByIdAsync(Guid messageId);
    Task<ChatMessage> AddMessageAsync(ChatMessage message);
    Task SaveChangesAsync();
} 