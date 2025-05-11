using ChattyWidget.Core.DTOs;
using System;
using System.Threading.Tasks;

namespace ChattyWidget.Core.Interfaces
{
    public interface IUserLlmPreferenceService
    {
        /// <summary>
        /// Get user's LLM preferences
        /// </summary>
        Task<LlmUserPreferenceDto> GetUserPreferencesAsync(Guid userId);
        
        /// <summary>
        /// Update user's LLM preferences
        /// </summary>
        Task<LlmUserPreferenceDto> UpdateUserPreferencesAsync(Guid userId, LlmUserPreferenceDto preferences);
        
        /// <summary>
        /// Get the appropriate model ID based on user preferences and subscription level
        /// </summary>
        Task<string> GetEffectiveModelIdAsync(Guid userId, string subscriptionLevel, string requestedModelId = null);
    }
}
