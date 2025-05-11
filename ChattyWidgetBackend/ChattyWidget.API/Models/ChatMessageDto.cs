using System;

namespace ChattyWidget.API.Models
{
    public class ChatMessageDto
    {
        public Guid Id { get; set; }
        public Guid ChatSessionId { get; set; }
        public required string Content { get; set; }
        public required string Sender { get; set; } // "user" or "assistant"
        public DateTime Timestamp { get; set; }
    }
} 