using ChattyWidget.Core.DTOs;
using ChattyWidget.Core.Interfaces;
using Microsoft.EntityFrameworkCore;
using ChattyWidget.Models;

namespace ChattyWidget.Core.Services;

public interface IUserService
{
    Task<AuthResponse?> LoginAsync(LoginRequest request);
    Task<AuthResponse?> RegisterAsync(RegisterRequest request);
    Task<ChattyWidget.Models.User?> GetUserByIdAsync(Guid userId);
    Task<bool> ChangePasswordAsync(Guid userId, ChangePasswordRequest request);
    Task<AuthResponse?> CreateSuperAdminAsync(string username, string email, string password);
    Task<List<string>> GetUserRolesAsync(Guid userId);
}

public class UserService : IUserService
{
    private readonly IUserRepository _userRepository;
    private readonly AuthService _authService;

    public UserService(IUserRepository userRepository, AuthService authService)
    {
        _userRepository = userRepository;
        _authService = authService;
    }

    public async Task<AuthResponse?> LoginAsync(LoginRequest request)
    {
        var user = await _userRepository.GetUserByEmailAsync(request.Email);

        if (user == null || !_authService.VerifyPassword(request.Password, user.PasswordHash))
            return null;

        // Update last login
        user.LastLoginAt = DateTime.UtcNow;
        await _userRepository.SaveChangesAsync();

        var token = _authService.GenerateJwtToken(user);
        return new AuthResponse(token, user.Id, user.Username, user.Email, user.Role);
    }

    public async Task<AuthResponse?> RegisterAsync(RegisterRequest request)
    {
        // Check if user already exists
        if (await _userRepository.IsEmailRegisteredAsync(request.Email))
            return null;

        var user = new ChattyWidget.Models.User
        {
            Id = Guid.NewGuid(),
            Username = request.Username,
            Email = request.Email,
            PasswordHash = _authService.HashPassword(request.Password),
            Role = "user", // Default role for new registrations
            CreatedAt = DateTime.UtcNow
        };

        await _userRepository.AddUserAsync(user);
        await _userRepository.SaveChangesAsync();

        var token = _authService.GenerateJwtToken(user);
        return new AuthResponse(token, user.Id, user.Username, user.Email, user.Role);
    }

    public async Task<ChattyWidget.Models.User?> GetUserByIdAsync(Guid userId)
    {
        return await _userRepository.GetUserByIdAsync(userId);
    }

    public async Task<bool> ChangePasswordAsync(Guid userId, ChangePasswordRequest request)
    {
        var user = await _userRepository.GetUserByIdAsync(userId);
        if (user == null || !_authService.VerifyPassword(request.OldPassword, user.PasswordHash))
            return false;

        user.PasswordHash = _authService.HashPassword(request.NewPassword);
        await _userRepository.SaveChangesAsync();
        return true;
    }

    // Additional method to add a superadmin user
    public async Task<AuthResponse?> CreateSuperAdminAsync(string username, string email, string password)
    {
        // Check if user already exists
        if (await _userRepository.IsEmailRegisteredAsync(email))
            return null;

        var user = new ChattyWidget.Models.User
        {
            Id = Guid.NewGuid(),
            Username = username,
            Email = email,
            PasswordHash = _authService.HashPassword(password),
            Role = "superadmin",
            CreatedAt = DateTime.UtcNow
        };

        await _userRepository.AddUserAsync(user);
        await _userRepository.SaveChangesAsync();

        var token = _authService.GenerateJwtToken(user);
        return new AuthResponse(token, user.Id, user.Username, user.Email, user.Role);
    }

    /// <summary>
    /// Get the roles for a user
    /// </summary>
    /// <param name="userId">The user ID</param>
    /// <returns>A list of role names</returns>
    public async Task<List<string>> GetUserRolesAsync(Guid userId)
    {
        var user = await _userRepository.GetUserByIdAsync(userId);
        if (user == null)
            return new List<string>();
        
        // In this implementation, we just return the single role
        // In a more complex system, you might query a UserRoles table
        return new List<string> { user.Role };
    }
} 