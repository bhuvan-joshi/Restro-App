using Microsoft.AspNetCore.Mvc;

namespace ChattyWidget.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class WidgetResourcesController : ControllerBase
{
    private readonly IWebHostEnvironment _environment;
    private readonly ILogger<WidgetResourcesController> _logger;

    public WidgetResourcesController(IWebHostEnvironment environment, ILogger<WidgetResourcesController> logger)
    {
        _environment = environment;
        _logger = logger;
    }
    
    [HttpGet("script")]
    public IActionResult GetWidgetScript()
    {
        try
        {
            // In a production environment, this would be minified and cached
            var path = Path.Combine(_environment.WebRootPath, "widget.js");
            var content = System.IO.File.ReadAllText(path);
            return Content(content, "application/javascript");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error serving widget script");
            return StatusCode(500, "Could not load widget script");
        }
    }
    
    [HttpGet("css")]
    public IActionResult GetWidgetCSS()
    {
        try
        {
            var path = Path.Combine(_environment.WebRootPath, "widget.css");
            var content = System.IO.File.ReadAllText(path);
            return Content(content, "text/css");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error serving widget CSS");
            return StatusCode(500, "Could not load widget CSS");
        }
    }
} 