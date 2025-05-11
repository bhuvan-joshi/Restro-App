using System;

namespace ChattyWidget.Core.DTOs;

public class LLMOptions
{
    /// <summary>
    /// The LLM provider (Ollama, OpenAI, AzureOpenAI, etc.)
    /// </summary>
    public string Provider { get; set; } = "Ollama";
    
    /// <summary>
    /// The endpoint URL for the LLM service API
    /// </summary>
    public string ApiEndpoint { get; set; }
    
    /// <summary>
    /// The API key for the LLM service
    /// </summary>
    public string ApiKey { get; set; }
    
    /// <summary>
    /// The default model to use if not specified
    /// </summary>
    public string DefaultModel { get; set; }
    
    /// <summary>
    /// Maximum tokens to generate in the response
    /// </summary>
    public int MaxTokens { get; set; } = 1024;
    
    /// <summary>
    /// Temperature setting for the LLM (0.0 to 1.0)
    /// </summary>
    public double Temperature { get; set; } = 0.7;
}
