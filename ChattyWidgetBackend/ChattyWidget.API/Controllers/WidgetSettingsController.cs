using ChattyWidget.Core.Services;
using ChattyWidget.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ChattyWidget.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class WidgetSettingsController : ControllerBase
{
    private readonly WidgetService _widgetService;
    private readonly ILogger<WidgetSettingsController> _logger;

    public WidgetSettingsController(WidgetService widgetService, ILogger<WidgetSettingsController> logger)
    {
        _widgetService = widgetService;
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
    
    [HttpGet]
    public async Task<ActionResult<IEnumerable<WidgetSettings>>> GetUserWidgets()
    {
        try
        {
            var userId = GetCurrentUserId();
            var widgets = await _widgetService.GetUserWidgetsAsync(userId);
            return Ok(widgets);
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting user widgets");
            return StatusCode(500, new { message = "An error occurred while retrieving widgets" });
        }
    }
    
    [HttpGet("{id}")]
    public async Task<ActionResult<WidgetSettings>> GetWidget(Guid id)
    {
        try
        {
            var userId = GetCurrentUserId();
            var widget = await _widgetService.GetWidgetByIdAsync(id, userId);
            
            if (widget == null)
                return NotFound();
                
            return Ok(widget);
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting widget {WidgetId}", id);
            return StatusCode(500, new { message = "An error occurred while retrieving the widget" });
        }
    }
    
    [HttpPost]
    public async Task<ActionResult<WidgetSettings>> CreateWidget(WidgetSettingsDto widgetDto)
    {
        try
        {
            var userId = GetCurrentUserId();
            
            // Override the userId with the authenticated user's ID for security
            widgetDto.UserId = userId;
            
            // Convert DTO to entity model
            var widget = new WidgetSettings
            {
                BotName = widgetDto.BotName,
                WelcomeMessage = widgetDto.WelcomeMessage,
                PrimaryColor = widgetDto.PrimaryColor,
                Position = widgetDto.Position,
                ModelId = widgetDto.ModelId,
                SiteName = widgetDto.SiteName,
                SiteDescription = widgetDto.SiteDescription,
                PrimaryContent = widgetDto.PrimaryContent,
                CustomKnowledge = widgetDto.CustomKnowledge,
                IsActive = widgetDto.IsActive,
                AllowedDomains = widgetDto.AllowedDomains,
                LogoUrl = widgetDto.LogoUrl,
                CustomCSS = widgetDto.CustomCSS,
                TrackingEnabled = widgetDto.TrackingEnabled,
                IsOfflineMode = widgetDto.IsOfflineMode,
                OfflineMessage = widgetDto.OfflineMessage,
                ShowSources = widgetDto.ShowSources,
                RequireEmailToStart = widgetDto.RequireEmailToStart,
                CollectUserFeedback = widgetDto.CollectUserFeedback,
                UserId = userId
            };
            
            var createdWidget = await _widgetService.CreateWidgetAsync(widget);
            return CreatedAtAction(nameof(GetWidget), new { id = createdWidget.Id }, createdWidget);
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating widget");
            return StatusCode(500, new { message = "An error occurred while creating the widget" });
        }
    }
    
    [HttpPut("{id}")]
    public async Task<ActionResult<WidgetSettings>> UpdateWidget(Guid id, WidgetSettingsDto widgetDto)
    {
        if (!widgetDto.Id.HasValue || id != widgetDto.Id)
            return BadRequest(new { message = "ID in URL doesn't match ID in request body" });
            
        try
        {
            var userId = GetCurrentUserId();
            
            // First fetch the existing widget to ensure it belongs to the user
            var existingWidget = await _widgetService.GetWidgetByIdAsync(id, userId);
            if (existingWidget == null)
                return NotFound();
            
            // Update all properties from the DTO
            existingWidget.BotName = widgetDto.BotName;
            existingWidget.WelcomeMessage = widgetDto.WelcomeMessage;
            existingWidget.PrimaryColor = widgetDto.PrimaryColor;
            existingWidget.Position = widgetDto.Position;
            existingWidget.ModelId = widgetDto.ModelId;
            existingWidget.SiteName = widgetDto.SiteName;
            existingWidget.SiteDescription = widgetDto.SiteDescription;
            existingWidget.PrimaryContent = widgetDto.PrimaryContent;
            existingWidget.CustomKnowledge = widgetDto.CustomKnowledge;
            existingWidget.IsActive = widgetDto.IsActive;
            existingWidget.AllowedDomains = widgetDto.AllowedDomains;
            existingWidget.LogoUrl = widgetDto.LogoUrl;
            existingWidget.CustomCSS = widgetDto.CustomCSS;
            existingWidget.TrackingEnabled = widgetDto.TrackingEnabled;
            existingWidget.UpdatedAt = DateTime.UtcNow;
            
            // Add behavior-specific fields
            existingWidget.IsOfflineMode = widgetDto.IsOfflineMode;
            existingWidget.OfflineMessage = widgetDto.OfflineMessage;
            existingWidget.ShowSources = widgetDto.ShowSources;
            existingWidget.RequireEmailToStart = widgetDto.RequireEmailToStart;
            existingWidget.CollectUserFeedback = widgetDto.CollectUserFeedback;
            
            var updatedWidget = await _widgetService.UpdateWidgetAsync(existingWidget);
            return Ok(updatedWidget);
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating widget {WidgetId}", id);
            return StatusCode(500, new { message = "An error occurred while updating the widget" });
        }
    }
    
    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteWidget(Guid id)
    {
        try
        {
            var userId = GetCurrentUserId();
            var result = await _widgetService.DeleteWidgetAsync(id, userId);
            
            if (!result)
                return NotFound();
                
            return NoContent();
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting widget {WidgetId}", id);
            return StatusCode(500, new { message = "An error occurred while deleting the widget" });
        }
    }
    
    // Public endpoint for widget embedding (no auth)
    [HttpGet("public/{id}")]
    [AllowAnonymous]
    public async Task<ActionResult<WidgetSettings>> GetPublicWidget(Guid id)
    {
        try
        {
            // Here we would need to validate the request against allowed domains
            // For simplicity, we'll just return the widget for now
            var widget = await _widgetService.GetPublicWidgetByIdAsync(id);
            
            if (widget == null || !widget.IsActive)
                return NotFound();
            
            // Return only the necessary public properties
            return Ok(new 
            {
                widget.Id,
                widget.BotName,
                widget.WelcomeMessage,
                widget.PrimaryColor,
                widget.Position,
                widget.SiteName,
                widget.SiteDescription,
                widget.LogoUrl,
                widget.CustomCSS
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting public widget {WidgetId}", id);
            return StatusCode(500, new { message = "An error occurred while retrieving the widget" });
        }
    }

    [HttpPost("debug")]
    [AllowAnonymous]
    public ActionResult DebugWidgetData([FromBody] object widgetData)
    {
        try
        {
            _logger.LogInformation("Debug widget data: {Data}", widgetData);
            
            // Return the received data as-is for debugging
            return Ok(new
            {
                receivedData = widgetData,
                message = "Data received successfully for debugging"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in debug endpoint");
            return StatusCode(500, new { message = "Error in debug endpoint", error = ex.Message });
        }
    }

    [HttpPost("settings/stripe")]
    public async Task<IActionResult> SaveStripeSettings([FromBody] StripeSettings stripeSettings)
    {
        try
        {
            // Save Stripe settings logic here
            await Task.Delay(1); // Placeholder for actual async save operation
            return Ok(new { message = "Stripe settings saved successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving Stripe settings");
            return StatusCode(500, new { error = "Failed to save Stripe settings" });
        }
    }

    [HttpPost("settings/paypal")]
    public async Task<IActionResult> SavePayPalSettings([FromBody] PayPalSettings payPalSettings)
    {
        try
        {
            // Save PayPal settings logic here
            await Task.Delay(1); // Placeholder for actual async save operation
            return Ok(new { message = "PayPal settings saved successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving PayPal settings");
            return StatusCode(500, new { error = "Failed to save PayPal settings" });
        }
    }
}