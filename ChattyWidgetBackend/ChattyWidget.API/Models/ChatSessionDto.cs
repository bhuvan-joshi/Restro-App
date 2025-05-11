using System;
using System.Collections.Generic;

namespace ChattyWidget.API.Models
{
    public class ChatSessionDto
    {
        public Guid Id { get; set; }
        public required string Title { get; set; }
        public DateTime CreatedAt { get; set; }
        public List<ChatMessageDto> Messages { get; set; } = new List<ChatMessageDto>();
    }
} 