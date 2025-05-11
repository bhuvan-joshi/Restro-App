using ChattyWidget.Core.Interfaces;
using ChattyWidget.Models.Agent;
using AgentQueryRequest = ChattyWidget.Models.Agent.AgentQueryRequest;
using AgentQueryResponse = ChattyWidget.Models.Agent.AgentQueryResponse;
using AgentFeedbackRequest = ChattyWidget.Models.Agent.AgentFeedbackRequest;
using DocumentReference = ChattyWidget.Models.Agent.DocumentReference;
using AgentModel = ChattyWidget.Models.Agent.AgentModel;
using TestScenario = ChattyWidget.Models.Agent.TestScenario;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Text;
using System.Net;

namespace ChattyWidget.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AgentController : ControllerBase
    {
        private readonly IAgentService _agentService;
        private readonly ILogger<AgentController> _logger;

        public AgentController(IAgentService agentService, ILogger<AgentController> logger)
        {
            _agentService = agentService;
            _logger = logger;
        }

        [HttpPost("query")]
        public async Task<IActionResult> QueryAgent([FromBody] AgentQueryRequest request)
        {
            if (string.IsNullOrEmpty(request.Query))
            {
                return BadRequest("Query cannot be empty");
            }

            try
            {
                // Increase the response timeout for larger models
                HttpContext.Response.RegisterForDispose(
                    new CancellationTokenSource(TimeSpan.FromMinutes(5)));
                
                var response = await _agentService.ProcessQueryAsync(request);
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing agent query");
                return StatusCode(500, "An error occurred while processing your query");
            }
        }

        [HttpGet("models")]
        public async Task<IActionResult> GetAvailableModels()
        {
            try
            {
                var models = _agentService.GetAvailableModels();
                return Ok(models);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving available models");
                return StatusCode(500, "An error occurred while retrieving available models");
            }
        }

        [HttpPost("feedback")]
        public async Task<IActionResult> SubmitFeedback([FromBody] AgentFeedbackRequest request)
        {
            if (string.IsNullOrEmpty(request.ResponseId))
            {
                return BadRequest("Response ID cannot be empty");
            }

            try
            {
                await _agentService.RecordFeedbackAsync(request);
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error recording agent feedback");
                return StatusCode(500, "An error occurred while recording feedback");
            }
        }

        [HttpGet("test-scenarios")]
        public IActionResult GetTestScenarios()
        {
            try
            {
                var scenarios = _agentService.GetTestScenarios();
                return Ok(scenarios);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving test scenarios");
                return StatusCode(500, "An error occurred while retrieving test scenarios");
            }
        }

        [HttpPost("stream")]
        public async Task StreamQuery([FromBody] AgentQueryRequest request)
        {
            try
            {
                // Validate model state
                if (!ModelState.IsValid)
                {
                    Response.StatusCode = (int)HttpStatusCode.BadRequest;
                    await Response.WriteAsync("Invalid request format");
                    return;
                }
                
                _logger.LogInformation($"Processing streaming agent query: {request.Query}");
                
                // Set up response headers for streaming
                Response.Headers.Append("Content-Type", "text/event-stream");
                Response.Headers.Append("Cache-Control", "no-cache");
                Response.Headers.Append("Connection", "keep-alive");
                Response.StatusCode = (int)HttpStatusCode.OK;
                
                // Create a cancellation token source that will
                // cancel after a timeout (e.g., 5 minutes)
                using var cts = new CancellationTokenSource(TimeSpan.FromMinutes(5));
                
                // Create callbacks for the streaming process
                Func<string, Task> onChunkReceived = async (chunk) =>
                {
                    // Format as SSE
                    string message = $"data: {chunk}\n\n";
                    await Response.WriteAsync(message, cts.Token);
                    await Response.Body.FlushAsync(cts.Token);
                };
                
                Func<Exception, Task> onError = async (ex) =>
                {
                    _logger.LogError(ex, "Error streaming response");
                    string errorMessage = $"data: [ERROR] {ex.Message}\n\n";
                    await Response.WriteAsync(errorMessage, cts.Token);
                    await Response.Body.FlushAsync(cts.Token);
                };
                
                Func<AgentQueryResponse, Task> onComplete = async (response) =>
                {
                    // Send the completed response object as a final event
                    string data = System.Text.Json.JsonSerializer.Serialize(new { 
                        type = "complete",
                        response = response 
                    });
                    string message = $"data: {data}\n\n";
                    
                    await Response.WriteAsync(message, cts.Token);
                    await Response.Body.FlushAsync(cts.Token);
                };
                
                // Stream the response
                await _agentService.StreamQueryAsync(request, onChunkReceived, onError, onComplete);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing agent query stream");
                Response.StatusCode = (int)HttpStatusCode.InternalServerError;
                await Response.WriteAsync($"Error processing agent query: {ex.Message}");
            }
        }
    }
}
