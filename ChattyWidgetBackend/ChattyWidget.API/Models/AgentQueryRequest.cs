using System.Collections.Generic;

namespace ChattyWidget.API.Models
{
    public class AgentQueryRequest
    {
        public string Query { get; set; }
        public string ModelId { get; set; }
        public List<string> DocumentIds { get; set; }
        public double ConfidenceThreshold { get; set; } = 0.7;
        public bool EnableHumanEscalation { get; set; } = true;
    }
}
