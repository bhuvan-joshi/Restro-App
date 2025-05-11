namespace ChattyWidget.Core.DTOs;

public record CreateSessionRequest(
    Guid WidgetId,
    string? UserLocation = null,
    string? UserDevice = null,
    string? ReferrerUrl = null);

public record SessionResponse(
    Guid Id,
    Guid WidgetId,
    string? UserLocation,
    string? UserDevice,
    string? ReferrerUrl,
    DateTime StartedAt,
    DateTime? EndedAt,
    List<MessageResponse> Messages);

public record SendMessageRequest(
    Guid SessionId,
    string Content,
    bool IsFromUser);

public record MessageResponse(
    Guid Id,
    Guid SessionId,
    string Content,
    bool IsFromUser,
    DateTime Timestamp,
    string? ModelUsed,
    int? TokenCount,
    string? SourceDocumentIds); 