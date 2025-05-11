using System.Collections.Generic;

namespace ChattyWidget.API.Models
{
    /// <summary>
    /// Generic class for paginated results
    /// </summary>
    /// <typeparam name="T">Type of items in the result</typeparam>
    public class PaginatedResult<T>
    {
        /// <summary>
        /// Collection of items for the current page
        /// </summary>
        public IEnumerable<T> Items { get; set; }
        
        /// <summary>
        /// Current page number (1-based)
        /// </summary>
        public int Page { get; set; }
        
        /// <summary>
        /// Number of items per page
        /// </summary>
        public int PageSize { get; set; }
        
        /// <summary>
        /// Total number of items across all pages
        /// </summary>
        public int TotalCount { get; set; }
        
        /// <summary>
        /// Total number of pages
        /// </summary>
        public int TotalPages { get; set; }
    }
}
