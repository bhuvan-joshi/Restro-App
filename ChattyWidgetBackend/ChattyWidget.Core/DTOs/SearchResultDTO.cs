using System;

namespace ChattyWidget.Core.DTOs
{
    public class SearchResultDTO
    {
        public Guid Id { get; set; }
        public Guid DocumentId { get; set; }
        public string Content { get; set; }
        public int ChunkIndex { get; set; }
        public string DocumentName { get; set; }
        public double Similarity { get; set; }
    }
} 