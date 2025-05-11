using ChattyWidget.Core.DTOs;
using ChattyWidget.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Threading.Tasks;

namespace ChattyWidget.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class LlmPreferencesController : ControllerBase
    {
        private readonly IUserLlmPreferenceService _preferencesService;
        private readonly ILogger<LlmPreferencesController> _logger;

        public LlmPreferencesController(
            IUserLlmPreferenceService preferencesService,
            ILogger<LlmPreferencesController> logger)
        {
            _preferencesService = preferencesService;
            _logger = logger;
        }

        [HttpGet]
        public async Task<IActionResult> GetUserPreferences()
        {
            try
            {
                // Extract user ID from JWT token claim
                if (!Guid.TryParse(User.FindFirst("uid")?.Value, out var userId))
                {
                    return Unauthorized();
                }

                var preferences = await _preferencesService.GetUserPreferencesAsync(userId);
                return Ok(preferences);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving user LLM preferences");
                return StatusCode(500, "An error occurred while retrieving LLM preferences");
            }
        }

        [HttpPut]
        public async Task<IActionResult> UpdateUserPreferences([FromBody] LlmUserPreferenceDto preferencesDto)
        {
            try
            {
                // Extract user ID from JWT token claim
                if (!Guid.TryParse(User.FindFirst("uid")?.Value, out var userId))
                {
                    return Unauthorized();
                }

                // Set the user ID from the token
                preferencesDto.UserId = userId;

                var updatedPreferences = await _preferencesService.UpdateUserPreferencesAsync(userId, preferencesDto);
                return Ok(updatedPreferences);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating user LLM preferences");
                return StatusCode(500, "An error occurred while updating LLM preferences");
            }
        }

        [HttpGet("models")]
        public IActionResult GetAvailableModels()
        {
            try
            {
                // For now, return a fixed list based on subscription levels
                // In a more advanced implementation, this would be dynamically generated
                var availableModels = new[]
                {
                    new { id = "llama3", name = "Llama 3 (8B)", provider = "Ollama", subscriptionLevel = "free" },
                    new { id = "mistral", name = "Mistral", provider = "Ollama", subscriptionLevel = "free" },
                    new { id = "gpt-4o-mini", name = "GPT-4o Mini", provider = "OpenAI", subscriptionLevel = "basic" },
                    new { id = "gpt-4o", name = "GPT-4o", provider = "OpenAI", subscriptionLevel = "premium" },
                    new { id = "claude-3-haiku", name = "Claude 3 Haiku", provider = "Anthropic", subscriptionLevel = "basic" },
                    new { id = "claude-3-opus", name = "Claude 3 Opus", provider = "Anthropic", subscriptionLevel = "premium" },
                };
                
                return Ok(availableModels);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving available LLM models");
                return StatusCode(500, "An error occurred while retrieving available models");
            }
        }
    }
}
