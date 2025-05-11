using System.Collections.Generic;

namespace ChattyWidget.Core.DTOs
{
    public class LlmResponse
    {
        /// <summary>
        /// The generated text response from the LLM
        /// </summary>
        public string Content { get; set; }
        
        /// <summary>
        /// Citations and sources used in generating the response
        /// </summary>
        public List<string> Citations { get; set; } = new List<string>();
        
        /// <summary>
        /// Estimated confidence score (0.0 to 1.0)
        /// </summary>
        public double Confidence { get; set; }
        
        /// <summary>
        /// The model ID that generated the response
        /// </summary>
        public string ModelId { get; set; }
        
        /// <summary>
        /// Additional metadata about the response generation
        /// </summary>
        public Dictionary<string, object> Metadata { get; set; } = new Dictionary<string, object>();
    }
}
