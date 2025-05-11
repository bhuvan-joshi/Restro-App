using ChattyWidget.Core.DTOs;
using ChattyWidget.Core.Interfaces;
using ChattyWidget.Models;
using Microsoft.EntityFrameworkCore;

namespace ChattyWidget.Core.Services;

public class ChatService
{
    private readonly IChatSessionRepository _sessionRepository;
    private readonly IChatMessageRepository _messageRepository;
    private readonly IWidgetRepository _widgetRepository;

    public ChatService(
        IChatSessionRepository sessionRepository,
        IChatMessageRepository messageRepository,
        IWidgetRepository widgetRepository)
    {
        _sessionRepository = sessionRepository;
        _messageRepository = messageRepository;
        _widgetRepository = widgetRepository;
    }

    public async Task<SessionResponse?> CreateSessionAsync(Guid userId, CreateSessionRequest request)
    {
        // Verify widget exists and belongs to a user (for now we'll just check it exists)
        var widget = await _widgetRepository.GetPublicWidgetByIdAsync(request.WidgetId);
        if (widget == null || !widget.IsActive)
            return null;

        var session = new ChatSession
        {
            UserId = userId,
            WidgetId = request.WidgetId,
            SessionIdentifier = Guid.NewGuid().ToString(), // Unique identifier that could be used for public access
            UserLocation = request.UserLocation,
            UserDevice = request.UserDevice,
            ReferrerUrl = request.ReferrerUrl
        };

        await _sessionRepository.CreateSessionAsync(session);
        await _sessionRepository.SaveChangesAsync();

        // Create welcome message from the bot
        var welcomeMessage = new ChatMessage
        {
            SessionId = session.Id,
            Content = widget.WelcomeMessage,
            IsFromUser = false,
            ModelUsed = widget.ModelId,
        };

        await _messageRepository.AddMessageAsync(welcomeMessage);
        await _messageRepository.SaveChangesAsync();

        return await GetSessionByIdAsync(session.Id);
    }

    public async Task<SessionResponse?> GetSessionByIdAsync(Guid sessionId)
    {
        var session = await _sessionRepository.GetSessionByIdAsync(sessionId);
        if (session == null)
            return null;

        var messages = await _messageRepository.GetSessionMessagesAsync(sessionId);

        return new SessionResponse(
            session.Id,
            session.WidgetId,
            session.UserLocation,
            session.UserDevice,
            session.ReferrerUrl,
            session.StartedAt,
            session.EndedAt,
            messages.Select(m => new MessageResponse(
                m.Id,
                m.SessionId,
                m.Content,
                m.IsFromUser,
                m.Timestamp,
                m.ModelUsed,
                m.TokenCount,
                m.SourceDocumentIds
            )).ToList()
        );
    }

    public async Task<List<SessionResponse>> GetUserSessionsAsync(Guid userId)
    {
        var sessions = await _sessionRepository.GetUserSessionsAsync(userId);
        var responses = new List<SessionResponse>();

        foreach (var session in sessions)
        {
            var messages = await _messageRepository.GetSessionMessagesAsync(session.Id);
            responses.Add(new SessionResponse(
                session.Id,
                session.WidgetId,
                session.UserLocation,
                session.UserDevice,
                session.ReferrerUrl,
                session.StartedAt,
                session.EndedAt,
                messages.Select(m => new MessageResponse(
                    m.Id,
                    m.SessionId,
                    m.Content,
                    m.IsFromUser,
                    m.Timestamp,
                    m.ModelUsed,
                    m.TokenCount,
                    m.SourceDocumentIds
                )).ToList()
            ));
        }

        return responses;
    }

    public async Task<MessageResponse?> SendMessageAsync(SendMessageRequest request)
    {
        var session = await _sessionRepository.GetSessionByIdAsync(request.SessionId);
        if (session == null)
            return null;

        var message = new ChatMessage
        {
            SessionId = request.SessionId,
            Content = request.Content,
            IsFromUser = request.IsFromUser
        };

        // If message is from user, we would typically generate a bot response here
        // For now we'll just save the user message
        await _messageRepository.AddMessageAsync(message);
        await _messageRepository.SaveChangesAsync();

        // If this is a user message, let's create a simple echo response
        if (request.IsFromUser)
        {
            var botResponse = new ChatMessage
            {
                SessionId = request.SessionId,
                Content = $"Echo: {request.Content}", // In a real app, this would be from an AI service
                IsFromUser = false,
                ModelUsed = "Echo Bot" // This would be the actual model used in production
            };

            await _messageRepository.AddMessageAsync(botResponse);
            await _messageRepository.SaveChangesAsync();
        }

        return new MessageResponse(
            message.Id,
            message.SessionId,
            message.Content,
            message.IsFromUser,
            message.Timestamp,
            message.ModelUsed,
            message.TokenCount,
            message.SourceDocumentIds
        );
    }

    public async Task EndSessionAsync(Guid sessionId)
    {
        var session = await _sessionRepository.GetSessionByIdAsync(sessionId);
        if (session == null)
            return;

        session.EndedAt = DateTime.UtcNow;
        await _sessionRepository.UpdateSessionAsync(session);
        await _sessionRepository.SaveChangesAsync();
    }
} 