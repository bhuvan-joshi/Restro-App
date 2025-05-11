using System;
using System.Collections.Generic;

namespace ChattyWidget.Core.Models
{
    public class Document
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? ContentType { get; set; }
        public long Size { get; set; }
        public DateTime UploadDate { get; set; }
        public Guid UserId { get; set; }
        public string? FileUrl { get; set; }  // Changed from FilePath
        public string? Content { get; set; }
        public string Type { get; set; } = string.Empty;
        public string Status { get; set; } = "processing";
        public string? Metadata { get; set; }
        public string? ErrorMessage { get; set; }
        public string? OriginalFileName { get; set; }
        public List<string> Tags { get; set; } = new List<string>();
    }
}
