using ChattyWidget.Core.DTOs;
using ChattyWidget.Core.Interfaces;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace ChattyWidget.Core.Services
{
    /// <summary>
    /// Manager class that selects the appropriate LLM service based on the model and user's subscription
    /// </summary>
    public class LlmServiceManager : ILlmService
    {
        private readonly ILogger<LlmServiceManager> _logger;
        private readonly IEnumerable<ILlmService> _llmServices;

        public LlmServiceManager(
            IEnumerable<ILlmService> llmServices,
            ILogger<LlmServiceManager> logger)
        {
            _llmServices = llmServices;
            _logger = logger;
        }

        public async Task<LlmResponse> GenerateResponseAsync(
            string query, 
            List<string> documentContents, 
            List<string> documentTitles, 
            string modelId)
        {
            // Find the appropriate LLM service for the requested model
            var provider = GetProviderForModel(modelId);
            if (string.IsNullOrEmpty(provider))
            {
                throw new ArgumentException($"No provider found for model: {modelId}");
            }
            
            // Get the service for this provider
            var llmService = _llmServices.FirstOrDefault(s => s.GetProviderForModel(modelId) == provider);
            if (llmService == null)
            {
                throw new ArgumentException($"No service implementation found for provider: {provider}");
            }
            
            _logger.LogInformation($"Using LLM provider {provider} for model {modelId}");
            
            // Delegate to the specific service implementation
            return await llmService.GenerateResponseAsync(query, documentContents, documentTitles, modelId);
        }

        public async Task StreamResponseAsync(
            string query,
            List<string> documentContents,
            List<string> documentTitles,
            string modelId,
            Func<string, Task> onChunkReceived,
            Func<Exception, Task> onError,
            Func<Task> onComplete)
        {
            try
            {
                // Find the appropriate LLM service for the requested model
                var provider = GetProviderForModel(modelId);
                if (string.IsNullOrEmpty(provider))
                {
                    throw new ArgumentException($"No provider found for model: {modelId}");
                }
                
                // Get the service for this provider
                var llmService = _llmServices.FirstOrDefault(s => s.GetProviderForModel(modelId) == provider);
                if (llmService == null)
                {
                    throw new ArgumentException($"No service implementation found for provider: {provider}");
                }
                
                _logger.LogInformation($"Using LLM provider {provider} for streaming with model {modelId}");
                
                // Delegate to the specific service implementation
                await llmService.StreamResponseAsync(
                    query, 
                    documentContents, 
                    documentTitles, 
                    modelId, 
                    onChunkReceived, 
                    onError, 
                    onComplete);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error in LlmServiceManager.StreamResponseAsync: {ex.Message}");
                await onError(ex);
            }
        }

        public bool IsModelAvailable(string modelId, string subscriptionLevel)
        {
            // Find the service that can handle this model
            foreach (var service in _llmServices)
            {
                var provider = service.GetProviderForModel(modelId);
                if (!string.IsNullOrEmpty(provider))
                {
                    // Check if the model is available for the user's subscription level
                    return service.IsModelAvailable(modelId, subscriptionLevel);
                }
            }
            
            return false;
        }

        public string GetProviderForModel(string modelId)
        {
            // Find the first service that recognizes this model
            foreach (var service in _llmServices)
            {
                var provider = service.GetProviderForModel(modelId);
                if (!string.IsNullOrEmpty(provider))
                {
                    return provider;
                }
            }
            
            return null;
        }

        public async Task<List<string>> GetAvailableOllamaModelsAsync()
        {
            // Find the Ollama service to delegate the call
            var ollamaService = _llmServices.FirstOrDefault(s => s.GetType().Name.Contains("Ollama"));
            
            if (ollamaService != null)
            {
                _logger.LogInformation("Delegating Ollama models discovery to OllamaLlmService");
                return await ollamaService.GetAvailableOllamaModelsAsync();
            }
            
            _logger.LogWarning("No Ollama service found to discover models");
            return new List<string>();
        }
    }
}
