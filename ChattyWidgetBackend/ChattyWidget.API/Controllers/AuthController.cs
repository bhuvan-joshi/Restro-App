using ChattyWidget.Core.DTOs;
using ChattyWidget.Core.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ChattyWidget.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly UserService _userService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(UserService userService, ILogger<AuthController> logger)
    {
        _userService = userService;
        _logger = logger;
    }
    
    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request)
    {
        try
        {
            var response = await _userService.LoginAsync(request);
            
            if (response == null)
                return Unauthorized(new { message = "Invalid email or password" });
                
            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during login");
            return StatusCode(500, new { message = "An error occurred during login" });
        }
    }
    
    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request)
    {
        try
        {
            var response = await _userService.RegisterAsync(request);
            
            if (response == null)
                return BadRequest(new { message = "User with this email already exists" });
                
            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during registration");
            return StatusCode(500, new { message = "An error occurred during registration" });
        }
    }
    
    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult> GetCurrentUser()
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            
            if (string.IsNullOrEmpty(userId) || !Guid.TryParse(userId, out var userGuid))
                return Unauthorized();
                
            var user = await _userService.GetUserByIdAsync(userGuid);
            
            if (user == null)
                return NotFound();
                
            return Ok(new 
            {
                user.Id,
                user.Username,
                user.Email,
                user.Role,
                user.CreatedAt,
                user.LastLoginAt
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting current user");
            return StatusCode(500, new { message = "An error occurred while retrieving user information" });
        }
    }
    
    [Authorize]
    [HttpPost("change-password")]
    public async Task<ActionResult> ChangePassword(ChangePasswordRequest request)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            
            if (string.IsNullOrEmpty(userId) || !Guid.TryParse(userId, out var userGuid))
                return Unauthorized();
                
            var result = await _userService.ChangePasswordAsync(userGuid, request);
            
            if (!result)
                return BadRequest(new { message = "Current password is incorrect" });
                
            return Ok(new { message = "Password changed successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error changing password");
            return StatusCode(500, new { message = "An error occurred while changing password" });
        }
    }

    [HttpGet("user-info")]
    [Authorize]
    public async Task<IActionResult> GetUserInfo()
    {
        try
        {
            // Get the current user ID from claims
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out Guid userId))
            {
                return Unauthorized("Invalid user ID");
            }

            // Get the user from the database
            var user = await _userService.GetUserByIdAsync(userId);
            if (user == null)
            {
                return NotFound("User not found");
            }

            // Get user roles
            var roles = await _userService.GetUserRolesAsync(userId);
            
            // If roles is empty, add the user.Role as a fallback
            if (roles == null || !roles.Any())
            {
                roles = new List<string> { user.Role };
            }

            // Return user info
            return Ok(new
            {
                Id = user.Id,
                UserName = user.Username,
                Email = user.Email,
                Role = user.Role,
                Roles = roles,
                IsSuperAdmin = user.Role.Equals("superadmin", StringComparison.OrdinalIgnoreCase) || 
                    roles.Any(r => r.Equals("superadmin", StringComparison.OrdinalIgnoreCase))
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving user info");
            return StatusCode(500, "An error occurred while retrieving user info");
        }
    }
} 