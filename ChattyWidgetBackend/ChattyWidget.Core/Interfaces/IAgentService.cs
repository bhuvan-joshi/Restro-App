using ChattyWidget.Models.Agent;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace ChattyWidget.Core.Interfaces
{
    public interface IAgentService
    {
        Task<AgentQueryResponse> ProcessQueryAsync(AgentQueryRequest request);
        
        // Add streaming method
        Task StreamQueryAsync(
            AgentQueryRequest request,
            Func<string, Task> onChunkReceived,
            Func<Exception, Task> onError,
            Func<AgentQueryResponse, Task> onComplete);
            
        List<AgentModel> GetAvailableModels();
        Task RecordFeedbackAsync(AgentFeedbackRequest request);
        List<TestScenario> GetTestScenarios();
    }
}
