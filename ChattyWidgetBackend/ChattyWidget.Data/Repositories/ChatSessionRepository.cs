using ChattyWidget.Core.Interfaces;
using ChattyWidget.Models;
using Microsoft.EntityFrameworkCore;

namespace ChattyWidget.Data.Repositories;

public class ChatSessionRepository : IChatSessionRepository
{
    private readonly ApplicationDbContext _context;

    public ChatSessionRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<ChatSession>> GetUserSessionsAsync(Guid userId)
    {
        return await _context.ChatSessions
            .Where(s => s.UserId == userId)
            .OrderByDescending(s => s.StartedAt)
            .ToListAsync();
    }

    public async Task<List<ChatSession>> GetWidgetSessionsAsync(Guid widgetId)
    {
        return await _context.ChatSessions
            .Where(s => s.WidgetId == widgetId)
            .OrderByDescending(s => s.StartedAt)
            .ToListAsync();
    }

    public async Task<ChatSession?> GetSessionByIdAsync(Guid sessionId)
    {
        return await _context.ChatSessions
            .Include(s => s.Messages)
            .FirstOrDefaultAsync(s => s.Id == sessionId);
    }

    public async Task<ChatSession> CreateSessionAsync(ChatSession session)
    {
        session.Id = Guid.NewGuid();
        session.StartedAt = DateTime.UtcNow;
        
        await _context.ChatSessions.AddAsync(session);
        return session;
    }

    public async Task UpdateSessionAsync(ChatSession session)
    {
        _context.Entry(session).State = EntityState.Modified;
    }

    public async Task SaveChangesAsync()
    {
        await _context.SaveChangesAsync();
    }
} 