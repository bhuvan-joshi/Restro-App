using ChattyWidget.Core.Interfaces;
using ChattyWidget.Models;
using Microsoft.EntityFrameworkCore;

namespace ChattyWidget.Data.Repositories;

public class ChatMessageRepository : IChatMessageRepository
{
    private readonly ApplicationDbContext _context;

    public ChatMessageRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<ChatMessage>> GetSessionMessagesAsync(Guid sessionId)
    {
        return await _context.ChatMessages
            .Where(m => m.SessionId == sessionId)
            .OrderBy(m => m.Timestamp)
            .ToListAsync();
    }

    public async Task<ChatMessage?> GetMessageByIdAsync(Guid messageId)
    {
        return await _context.ChatMessages.FindAsync(messageId);
    }

    public async Task<ChatMessage> AddMessageAsync(ChatMessage message)
    {
        message.Id = Guid.NewGuid();
        message.Timestamp = DateTime.UtcNow;
        
        await _context.ChatMessages.AddAsync(message);
        return message;
    }

    public async Task SaveChangesAsync()
    {
        await _context.SaveChangesAsync();
    }
} 