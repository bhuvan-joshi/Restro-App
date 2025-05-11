using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using ChattyWidget.API.Models;
using ChattyWidget.Core.DTOs;
using ChattyWidget.Core.Interfaces;
using ChattyWidget.Core.Services;
using ChattyWidget.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Microsoft.Extensions.Logging;

namespace ChattyWidget.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ChatController : ControllerBase
{
    private readonly ChatService _chatService;
    private readonly IChatSessionRepository _sessionRepository;
    private readonly IChatMessageRepository _messageRepository;
    private readonly ILogger<ChatController> _logger;

    public ChatController(
        ChatService chatService,
        IChatSessionRepository sessionRepository,
        IChatMessageRepository messageRepository,
        ILogger<ChatController> logger)
    {
        _chatService = chatService;
        _sessionRepository = sessionRepository;
        _messageRepository = messageRepository;
        _logger = logger;
    }

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
        {
            throw new UnauthorizedAccessException("User is not authenticated");
        }
        return userId;
    }

    // Private API Methods (require authentication)
    
    [Authorize]
    [HttpGet("sessions")]
    public async Task<ActionResult<List<ChatSessionDto>>> GetSessions()
    {
        try
        {
            // For demo, we'll use a hardcoded userId
            var userId = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var sessions = await _sessionRepository.GetUserSessionsAsync(userId);
            
            return sessions.Select(s => new ChatSessionDto
            {
                Id = s.Id,
                Title = $"Chat {s.StartedAt:MM/dd/yyyy}",
                CreatedAt = s.StartedAt,
                Messages = new List<ChatMessageDto>()
            }).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving sessions");
            return StatusCode(500, "An error occurred while retrieving sessions");
        }
    }

    [Authorize]
    [HttpGet("sessions/{sessionId}")]
    public async Task<ActionResult<ChatSessionDto>> GetSession(Guid sessionId)
    {
        try
        {
            var session = await _sessionRepository.GetSessionByIdAsync(sessionId);
            if (session == null)
                return NotFound();

            var messages = await _messageRepository.GetSessionMessagesAsync(sessionId);
            
            return new ChatSessionDto
            {
                Id = session.Id,
                Title = $"Chat {session.StartedAt:MM/dd/yyyy}",
                CreatedAt = session.StartedAt,
                Messages = messages.Select(m => new ChatMessageDto
                {
                    Id = m.Id,
                    ChatSessionId = m.SessionId,
                    Content = m.Content,
                    Sender = m.IsFromUser ? "user" : "assistant",
                    Timestamp = m.Timestamp
                }).ToList()
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving session {SessionId}", sessionId);
            return StatusCode(500, "An error occurred while retrieving the session");
        }
    }
    
    [Authorize]
    [HttpPost("sessions")]
    public async Task<ActionResult<ChatSessionDto>> CreateSession()
    {
        try
        {
            // For demo, we'll use a hardcoded userId and widgetId
            var userId = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var widgetId = Guid.Parse("00000000-0000-0000-0000-000000000001");
            
            var request = new CreateSessionRequest(widgetId);
            var response = await _chatService.CreateSessionAsync(userId, request);
            
            if (response == null)
                return BadRequest("Could not create session");
                
            return new ChatSessionDto
            {
                Id = response.Id,
                Title = $"Chat {response.StartedAt:MM/dd/yyyy}",
                CreatedAt = response.StartedAt,
                Messages = response.Messages.Select(m => new ChatMessageDto
                {
                    Id = m.Id,
                    ChatSessionId = m.SessionId,
                    Content = m.Content,
                    Sender = m.IsFromUser ? "user" : "assistant",
                    Timestamp = m.Timestamp
                }).ToList()
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating session");
            return StatusCode(500, "An error occurred while creating the session");
        }
    }
    
    [Authorize]
    [HttpPost("messages")]
    public async Task<ActionResult<ChatMessageDto>> SendMessage([FromBody] SendMessageRequest request)
    {
        try
        {
            // Create a new message
            var message = new ChatMessage
            {
                SessionId = request.SessionId,
                Content = request.Content,
                IsFromUser = true
            };
            
            await _messageRepository.AddMessageAsync(message);
            await _messageRepository.SaveChangesAsync();
            
            // TODO: In a real implementation, we would call an AI service here
            // For now, we'll just echo back a response
            var botResponse = new ChatMessage
            {
                SessionId = request.SessionId,
                Content = $"Echo: {request.Content}",
                IsFromUser = false,
                ModelUsed = "Echo Bot"
            };
            
            await _messageRepository.AddMessageAsync(botResponse);
            await _messageRepository.SaveChangesAsync();
            
            return new ChatMessageDto
            {
                Id = botResponse.Id,
                ChatSessionId = botResponse.SessionId,
                Content = botResponse.Content,
                Sender = "assistant",
                Timestamp = botResponse.Timestamp
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending message");
            return StatusCode(500, "An error occurred while sending the message");
        }
    }
    
    [Authorize]
    [HttpPost("sessions/{id}/end")]
    public async Task<ActionResult> EndSession(Guid id)
    {
        try
        {
            await _chatService.EndSessionAsync(id);
            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error ending session {SessionId}", id);
            return StatusCode(500, new { message = "An error occurred while ending the session" });
        }
    }
    
    // Public API Methods (no authentication required)
    
    [AllowAnonymous]
    [HttpPost("public/sessions")]
    public async Task<ActionResult<SessionResponse>> CreatePublicSession(CreateSessionRequest request)
    {
        try
        {
            // Here we would typically have a system user ID or a user specifically for public chats
            // For this example, we'll use a hardcoded GUID
            var systemUserId = Guid.Parse("00000000-0000-0000-0000-000000000001");
            
            var session = await _chatService.CreateSessionAsync(systemUserId, request);
            
            if (session == null)
                return BadRequest(new { message = "Invalid widget ID or widget is not active" });
                
            return CreatedAtAction(nameof(GetPublicSession), new { id = session.Id }, session);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating public chat session");
            return StatusCode(500, new { message = "An error occurred while creating the session" });
        }
    }
    
    [AllowAnonymous]
    [HttpGet("public/sessions/{id}")]
    public async Task<ActionResult<SessionResponse>> GetPublicSession(Guid id)
    {
        try
        {
            var session = await _chatService.GetSessionByIdAsync(id);
            
            if (session == null)
                return NotFound();
                
            return Ok(session);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving public session {SessionId}", id);
            return StatusCode(500, new { message = "An error occurred while retrieving the session" });
        }
    }
    
    [AllowAnonymous]
    [HttpPost("public/messages")]
    public async Task<ActionResult<MessageResponse>> SendPublicMessage(SendMessageRequest request)
    {
        try
        {
            var message = await _chatService.SendMessageAsync(request);
            
            if (message == null)
                return NotFound(new { message = "Session not found" });
                
            return Ok(message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending public message");
            return StatusCode(500, new { message = "An error occurred while sending the message" });
        }
    }
} 