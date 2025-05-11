using ChattyWidget.Core.DTOs;
using ChattyWidget.Core.Interfaces;
using ChattyWidget.Models;
using Microsoft.Extensions.Logging;
using System;
using System.Threading.Tasks;

namespace ChattyWidget.Core.Services
{
    public class UserLlmPreferenceService : IUserLlmPreferenceService
    {
        private readonly IUserLlmPreferenceRepository _preferencesRepository;
        private readonly IUserRepository _userRepository;
        private readonly ILlmService _llmService;
        private readonly ILogger<UserLlmPreferenceService> _logger;

        public UserLlmPreferenceService(
            IUserLlmPreferenceRepository preferencesRepository,
            IUserRepository userRepository,
            ILlmService llmService,
            ILogger<UserLlmPreferenceService> logger)
        {
            _preferencesRepository = preferencesRepository;
            _userRepository = userRepository;
            _llmService = llmService;
            _logger = logger;
        }

        public async Task<LlmUserPreferenceDto> GetUserPreferencesAsync(Guid userId)
        {
            try
            {
                var preferences = await _preferencesRepository.GetByUserIdAsync(userId);
                
                return new LlmUserPreferenceDto
                {
                    UserId = userId,
                    PreferredModelId = preferences.PreferredModelId,
                    Temperature = preferences.Temperature,
                    MaxTokens = preferences.MaxTokens,
                    EnableStreaming = preferences.EnableStreaming
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error retrieving LLM preferences for user {userId}");
                
                // Return default preferences
                return new LlmUserPreferenceDto
                {
                    UserId = userId,
                    PreferredModelId = "llama3.2:latest",
                    Temperature = 0.7,
                    MaxTokens = 800,
                    EnableStreaming = false
                };
            }
        }

        public async Task<LlmUserPreferenceDto> UpdateUserPreferencesAsync(Guid userId, LlmUserPreferenceDto preferencesDto)
        {
            try
            {
                // Check if user exists
                var user = await _userRepository.GetUserByIdAsync(userId);
                if (user == null)
                {
                    throw new InvalidOperationException($"User with ID {userId} not found");
                }
                
                // Get subscription level from user
                string subscriptionLevel = "free"; // Default to free
                
                // Check if model is valid for the subscription level
                if (!_llmService.IsModelAvailable(preferencesDto.PreferredModelId, subscriptionLevel))
                {
                    // Fall back to a valid model for this subscription level
                    preferencesDto.PreferredModelId = GetDefaultModelForSubscription(subscriptionLevel);
                    _logger.LogWarning($"Requested model {preferencesDto.PreferredModelId} not available for user's subscription level. Using {preferencesDto.PreferredModelId} instead.");
                }
                
                // Check if preferences exist
                if (await _preferencesRepository.HasPreferencesAsync(userId))
                {
                    // Update existing preferences
                    var existingPreferences = await _preferencesRepository.GetByUserIdAsync(userId);
                    existingPreferences.PreferredModelId = preferencesDto.PreferredModelId;
                    existingPreferences.Temperature = Math.Clamp(preferencesDto.Temperature, 0.0, 1.0);
                    existingPreferences.MaxTokens = Math.Clamp(preferencesDto.MaxTokens, 100, 2000);
                    existingPreferences.EnableStreaming = preferencesDto.EnableStreaming;
                    
                    await _preferencesRepository.UpdatePreferencesAsync(existingPreferences);
                }
                else
                {
                    // Create new preferences
                    var newPreferences = new UserLlmPreference
                    {
                        UserId = userId,
                        PreferredModelId = preferencesDto.PreferredModelId,
                        Temperature = Math.Clamp(preferencesDto.Temperature, 0.0, 1.0),
                        MaxTokens = Math.Clamp(preferencesDto.MaxTokens, 100, 2000),
                        EnableStreaming = preferencesDto.EnableStreaming,
                        LastUpdated = DateTime.UtcNow
                    };
                    
                    await _preferencesRepository.CreatePreferencesAsync(newPreferences);
                }
                
                // Save changes
                await _preferencesRepository.SaveChangesAsync();
                
                return await GetUserPreferencesAsync(userId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error updating LLM preferences for user {userId}");
                throw;
            }
        }

        public async Task<string> GetEffectiveModelIdAsync(Guid userId, string subscriptionLevel, string requestedModelId = null)
        {
            try
            {
                string modelId;
                
                // If a specific model is requested, use that if allowed by subscription
                if (!string.IsNullOrWhiteSpace(requestedModelId))
                {
                    if (_llmService.IsModelAvailable(requestedModelId, subscriptionLevel))
                    {
                        return requestedModelId;
                    }
                    
                    _logger.LogWarning($"Requested model {requestedModelId} not available for subscription level {subscriptionLevel}");
                }
                
                // Otherwise, use the user's preferred model if it's allowed by subscription
                var preferences = await _preferencesRepository.GetByUserIdAsync(userId);
                if (_llmService.IsModelAvailable(preferences.PreferredModelId, subscriptionLevel))
                {
                    return preferences.PreferredModelId;
                }
                
                // If neither requested nor preferred model is available, use the default for subscription level
                modelId = GetDefaultModelForSubscription(subscriptionLevel);
                _logger.LogInformation($"Using default model {modelId} for subscription level {subscriptionLevel}");
                
                return modelId;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error determining effective model ID for user {userId}");
                // Fall back to a safe default
                return "llama3";
            }
        }
        
        private string GetDefaultModelForSubscription(string subscriptionLevel)
        {
            // Simple logic to choose a default model based on subscription level
            switch (subscriptionLevel?.ToLower())
            {
                case "premium":
                    return "gpt-4o";
                case "basic":
                    return "gpt-4o-mini";
                case "free":
                default:
                    return "llama3";
            }
        }
    }
}
