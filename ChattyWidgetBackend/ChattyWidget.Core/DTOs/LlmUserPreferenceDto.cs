using System;

namespace ChattyWidget.Core.DTOs
{
    /// <summary>
    /// Data transfer object for user LLM preferences
    /// </summary>
    public class LlmUserPreferenceDto
    {
        /// <summary>
        /// User's ID
        /// </summary>
        public Guid UserId { get; set; }
        
        /// <summary>
        /// The ID of the preferred model
        /// </summary>
        public string PreferredModelId { get; set; }
        
        /// <summary>
        /// The temperature setting (0.0 - 1.0)
        /// </summary>
        public double Temperature { get; set; }
        
        /// <summary>
        /// Maximum tokens to generate
        /// </summary>
        public int MaxTokens { get; set; }
        
        /// <summary>
        /// Whether to stream responses if supported
        /// </summary>
        public bool EnableStreaming { get; set; }
    }
}
