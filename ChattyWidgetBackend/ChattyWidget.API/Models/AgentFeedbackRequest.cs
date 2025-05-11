namespace ChattyWidget.API.Models
{
    public class AgentFeedbackRequest
    {
        public string ResponseId { get; set; }
        public string Feedback { get; set; }
        public string Comments { get; set; }
    }
}
