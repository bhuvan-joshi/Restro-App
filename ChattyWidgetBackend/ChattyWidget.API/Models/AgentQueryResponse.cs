using System;
using System.Collections.Generic;

namespace ChattyWidget.API.Models
{
    public class AgentQueryResponse
    {
        public string ResponseId { get; set; } = Guid.NewGuid().ToString();
        public string Response { get; set; }
        public List<DocumentReference> Sources { get; set; }
        public double Confidence { get; set; }
        public bool NeedsHumanReview { get; set; }
        public string ModelId { get; set; }
    }
}
