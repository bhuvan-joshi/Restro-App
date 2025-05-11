using System.Collections.Generic;

namespace ChattyWidget.Models.Agent
{
    public class AgentModel
    {
        public string Id { get; set; }
        public string Name { get; set; }
        public string Provider { get; set; }
        public string Description { get; set; }
        public int ContextWindowSize { get; set; }
        public string KnowledgeCutoff { get; set; }
        public List<string> Capabilities { get; set; }
        public string SubscriptionLevel { get; set; }
    }
}
