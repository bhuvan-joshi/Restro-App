using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using System.Threading.Tasks;

namespace ChattyWidget.API.Controllers
{
    [ApiController]
    [Route("api/admin")]
    [Authorize(Roles = "Admin,admin,superadmin")]
    public class AdminController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly IConfigurationRoot _configRoot;

        public AdminController(IConfiguration configuration)
        {
            _configuration = configuration;
            _configRoot = (IConfigurationRoot)configuration;
        }

        [HttpGet("settings/system-prompt")]
        public IActionResult GetSystemPrompt()
        {
            var systemPrompt = _configuration["LlmProvider:SystemPrompt"];
            return Ok(new { systemPrompt });
        }

        [HttpPut("settings/system-prompt")]
        public async Task<IActionResult> UpdateSystemPrompt([FromBody] SystemPromptUpdateRequest request)
        {
            try
            {
                var filePath = "appsettings.json";
                var jsonString = System.IO.File.ReadAllText(filePath);
                var jsonObj = System.Text.Json.JsonDocument.Parse(jsonString);
                var root = jsonObj.RootElement.Clone();
                var mutable = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonDocument>(
                    System.Text.Json.JsonSerializer.Serialize(root)
                ).RootElement;

                var options = new System.Text.Json.JsonSerializerOptions
                {
                    WriteIndented = true
                };

                var element = mutable.GetProperty("LlmProvider");
                var newElement = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(
                    System.Text.Json.JsonSerializer.Serialize(new
                    {
                        SystemPrompt = request.SystemPrompt,
                        OpenAI = element.GetProperty("OpenAI"),
                        Ollama = element.GetProperty("Ollama")
                    })
                );

                var newJson = System.Text.Json.JsonSerializer.Serialize(
                    new
                    {
                        ConnectionStrings = root.GetProperty("ConnectionStrings"),
                        JWT = root.GetProperty("JWT"),
                        Logging = root.GetProperty("Logging"),
                        AllowedHosts = root.GetProperty("AllowedHosts"),
                        FileStorage = root.GetProperty("FileStorage"),
                        LlmProviders = root.GetProperty("LlmProviders"),
                        LlmProvider = newElement
                    },
                    options
                );

                await System.IO.File.WriteAllTextAsync(filePath, newJson);
                
                // Reload configuration
                _configRoot.Reload();

                return Ok(new { message = "System prompt updated successfully" });
            }
            catch (System.Exception ex)
            {
                return StatusCode(500, new { message = $"Failed to update system prompt: {ex.Message}" });
            }
        }
    }

    public class SystemPromptUpdateRequest
    {
        public string SystemPrompt { get; set; }
    }
} 