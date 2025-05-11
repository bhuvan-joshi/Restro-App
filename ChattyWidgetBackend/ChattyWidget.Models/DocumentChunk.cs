using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ChattyWidget.Models
{
    public class DocumentChunk
    {
        [Key]
        public Guid Id { get; set; }
        
        [Required]
        public Guid DocumentId { get; set; }
        
        [Required]
        public string Content { get; set; }
        
        // Store embedding vector as JSON string
        public string? EmbeddingVector { get; set; }
        
        // Identifies the chunk's position in document
        public int ChunkIndex { get; set; }
        
        public DateTime CreatedAt { get; set; }
        
        // Navigation property
        [ForeignKey("DocumentId")]
        public Document Document { get; set; }
    }
} 