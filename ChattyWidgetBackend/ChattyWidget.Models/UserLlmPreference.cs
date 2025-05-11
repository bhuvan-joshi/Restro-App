using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ChattyWidget.Models
{
    /// <summary>
    /// User LLM preferences for storing model selection and settings
    /// </summary>
    public class UserLlmPreference
    {
        [Key]
        public int Id { get; set; }
        
        /// <summary>
        /// Foreign key to User
        /// </summary>
        public Guid UserId { get; set; }
        
        /// <summary>
        /// The ID of the preferred model 
        /// </summary>
        [MaxLength(50)]
        public string PreferredModelId { get; set; }
        
        /// <summary>
        /// The temperature setting for responses (0.0 - 1.0)
        /// </summary>
        [Range(0.0, 1.0)]
        public double Temperature { get; set; } = 0.7;
        
        /// <summary>
        /// Maximum tokens to generate in the response
        /// </summary>
        public int MaxTokens { get; set; } = 800;
        
        /// <summary>
        /// Whether to stream responses if the model supports it
        /// </summary>
        public bool EnableStreaming { get; set; } = false;
        
        /// <summary>
        /// When this preference was last updated
        /// </summary>
        public DateTime LastUpdated { get; set; } = DateTime.UtcNow;
        
        /// <summary>
        /// Navigation property to the user
        /// </summary>
        [ForeignKey("UserId")]
        public virtual User User { get; set; }
    }
}
