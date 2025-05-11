namespace ChattyWidget.API.Models
{
    public class DocumentReference
    {
        public string DocumentId { get; set; }
        public string Title { get; set; }
        public string Url { get; set; }
        public double Relevance { get; set; }
    }
}
