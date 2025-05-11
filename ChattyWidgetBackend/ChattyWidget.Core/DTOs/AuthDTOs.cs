namespace ChattyWidget.Core.DTOs;

public record LoginRequest(string Email, string Password);

public record RegisterRequest(string Username, string Email, string Password);

public record AuthResponse(string Token, Guid UserId, string Username, string Email, string Role);

public record ChangePasswordRequest(string OldPassword, string NewPassword); 