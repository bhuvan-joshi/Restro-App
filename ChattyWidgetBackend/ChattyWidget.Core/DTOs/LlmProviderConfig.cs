namespace ChattyWidget.Core.DTOs
{
    public class LlmProviderConfig
    {
        /// <summary>
        /// Configuration for OpenAI LLM provider
        /// </summary>
        public OpenAIConfig OpenAI { get; set; } = new OpenAIConfig();
        
        /// <summary>
        /// Configuration for Ollama LLM provider (open source)
        /// </summary>
        public OllamaConfig Ollama { get; set; } = new OllamaConfig();
        
        /// <summary>
        /// Configuration for Azure OpenAI LLM provider
        /// </summary>
        public LlmProviderSettings AzureOpenAI { get; set; } = new LlmProviderSettings();
        
        /// <summary>
        /// Configuration for Anthropic LLM provider
        /// </summary>
        public LlmProviderSettings Anthropic { get; set; } = new LlmProviderSettings();
        
        /// <summary>
        /// Configuration for DeepSeek LLM provider
        /// </summary>
        public LlmProviderSettings DeepSeek { get; set; } = new LlmProviderSettings();
        
        /// <summary>
        /// System prompt for the LLM provider
        /// </summary>
        public string SystemPrompt { get; set; }
    }
    
    public class LlmProviderSettings
    {
        /// <summary>
        /// API Key for authentication with the provider
        /// </summary>
        public string ApiKey { get; set; }
        
        /// <summary>
        /// API Endpoint URL for the provider
        /// </summary>
        public string ApiEndpoint { get; set; }
        
        /// <summary>
        /// Default model to use with this provider
        /// </summary>
        public string DefaultModel { get; set; }
        
        /// <summary>
        /// Organization ID (if applicable)
        /// </summary>
        public string OrganizationId { get; set; }
        
        /// <summary>
        /// Whether this provider is enabled
        /// </summary>
        public bool Enabled { get; set; } = false;
    }

    public class OpenAIConfig
    {
        /// <summary>
        /// API Key for authentication with the provider
        /// </summary>
        public string ApiKey { get; set; }
        
        /// <summary>
        /// API Endpoint URL for the provider
        /// </summary>
        public string BaseUrl { get; set; }
    }

    public class OllamaConfig
    {
        /// <summary>
        /// API Endpoint URL for the provider
        /// </summary>
        public string BaseUrl { get; set; }
    }
}
