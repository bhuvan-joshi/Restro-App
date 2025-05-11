using ChattyWidget.Models.Agent;
using System.Collections.Generic;
using System.Threading.Tasks;
using ChattyWidget.Core.DTOs;
using System;

namespace ChattyWidget.Core.Interfaces
{
    public interface ILlmService
    {
        /// <summary>
        /// Generate a response using an LLM with document context
        /// </summary>
        /// <param name="query">The user's query</param>
        /// <param name="documentContents">List of document contents to use as context</param>
        /// <param name="documentTitles">List of document titles for citation</param>
        /// <param name="modelId">The ID of the model to use</param>
        /// <returns>The LLM-generated response</returns>
        Task<LlmResponse> GenerateResponseAsync(
            string query, 
            List<string> documentContents, 
            List<string> documentTitles, 
            string modelId);
            
        /// <summary>
        /// Check if the specified model is available and the user has access to it
        /// </summary>
        /// <param name="modelId">The model ID to check</param>
        /// <param name="subscriptionLevel">The user's subscription level</param>
        /// <returns>True if the model is available and accessible, false otherwise</returns>
        bool IsModelAvailable(string modelId, string subscriptionLevel);
        
        /// <summary>
        /// Get the provider for a specific model ID
        /// </summary>
        /// <param name="modelId">The model ID</param>
        /// <returns>The provider name (OpenAI, Ollama, etc.)</returns>
        string GetProviderForModel(string modelId);

        /// <summary>
        /// Get available models from the Ollama API
        /// </summary>
        /// <returns>List of available model IDs</returns>
        Task<List<string>> GetAvailableOllamaModelsAsync();

        // Add streaming method
        Task StreamResponseAsync(
            string query,
            List<string> documentContents,
            List<string> documentTitles,
            string modelId,
            Func<string, Task> onChunkReceived,
            Func<Exception, Task> onError,
            Func<Task> onComplete);
    }
}
