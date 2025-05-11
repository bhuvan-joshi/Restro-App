using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System.Text.RegularExpressions;
using HtmlAgilityPack;
using System.Linq;
using System.Security.Claims;
using ChattyWidget.Data;
using ChattyWidget.Models;
using System.Net;
using System.Net.Sockets;
using Microsoft.AspNetCore.SignalR;
using ChattyWidget.API.Hubs;

namespace ChattyWidget.API.Controllers;

public class WebsiteCrawlException : Exception
{
    public HttpStatusCode StatusCode { get; }

    public WebsiteCrawlException(string message, HttpStatusCode statusCode = HttpStatusCode.BadRequest) 
        : base(message)
    {
        StatusCode = statusCode;
    }
}

public class CrawlProgressUpdate
{
    public string CurrentUrl { get; set; }
    public int DiscoveredUrlsCount { get; set; }
    public int ProcessedUrlsCount { get; set; }
    public string CurrentAction { get; set; }
    public int Progress { get; set; }
}

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class WebsiteController : ControllerBase
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<WebsiteController> _logger;
    private readonly ApplicationDbContext _context;
    private readonly IHubContext<CrawlProgressHub> _hubContext;

    private CrawlProgressUpdate _currentProgress;

    public WebsiteController(
        IHttpClientFactory httpClientFactory, 
        ILogger<WebsiteController> logger,
        ApplicationDbContext context,
        IHubContext<CrawlProgressHub> hubContext)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _context = context;
        _hubContext = hubContext;
    }

    [HttpPost("crawl")]
    public async Task<IActionResult> CrawlWebsite([FromBody] CrawlWebsiteRequest request)
    {
        try
        {
            if (request == null)
            {
                return BadRequest(new { message = "Request body is required" });
            }

            if (string.IsNullOrEmpty(request.Url))
            {
                return BadRequest(new { message = "URL is required" });
            }

            if (!TryGetCurrentUserId(out Guid userId))
            {
                return Unauthorized(new { message = "User authentication required" });
            }

            // Validate URL format
            if (!Uri.TryCreate(request.Url, UriKind.Absolute, out Uri? uri) || 
                uri == null || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            {
                return BadRequest(new { message = "Invalid URL format. Must be a valid HTTP or HTTPS URL." });
            }

            // Validate other parameters
            if (request.MaxDepth < 0 || request.MaxDepth > 10)
            {
                return BadRequest(new { message = "MaxDepth must be between 0 and 10" });
            }

            _logger.LogInformation("Starting crawl of website: {Url}", request.Url);

            _currentProgress = new CrawlProgressUpdate
            {
                CurrentUrl = request.Url,
                DiscoveredUrlsCount = 0,
                ProcessedUrlsCount = 0,
                CurrentAction = "Starting crawl...",
                Progress = 0
            };
        
            // Send initial progress update via SignalR
            await _hubContext.Clients.All.SendAsync("CrawlProgressUpdate", _currentProgress);

            using var httpClient = _httpClientFactory.CreateClient();
            httpClient.DefaultRequestHeaders.Add("User-Agent", "ChattyWidget Crawler/1.0");
            httpClient.Timeout = TimeSpan.FromSeconds(30);

            // Validate website accessibility with a HEAD request first
            try
            {
                var response = await httpClient.SendAsync(new HttpRequestMessage(HttpMethod.Head, uri));
                response.EnsureSuccessStatusCode();
            }
            catch (HttpRequestException ex)
            {
                if (ex.InnerException is SocketException socketEx)
                {
                    switch (socketEx.SocketErrorCode)
                    {
                        case SocketError.HostNotFound:
                            return NotFound(new { message = "Website not found. Please check if the domain exists." });
                        case SocketError.ConnectionRefused:
                            return BadRequest(new { message = "Could not connect to the website. The server refused the connection." });
                        case SocketError.TimedOut:
                            return StatusCode(504, new { message = "Connection timed out. The website took too long to respond." });
                        default:
                            return BadRequest(new { message = $"Network error: {socketEx.Message}" });
                    }
                }

                switch (ex.StatusCode)
                {
                    case HttpStatusCode.NotFound:
                        return NotFound(new { message = "The website could not be found (404)." });
                    case HttpStatusCode.Unauthorized:
                        return StatusCode(401, new { message = "The website requires authentication." });
                    case HttpStatusCode.Forbidden:
                        return StatusCode(403, new { message = "Access to this website is forbidden (403)." });
                    case HttpStatusCode.BadGateway:
                        return StatusCode(502, new { message = "The website is currently unavailable (502)." });
                    case HttpStatusCode.ServiceUnavailable:
                        return StatusCode(503, new { message = "The website is temporarily unavailable (503)." });
                    case HttpStatusCode.GatewayTimeout:
                        return StatusCode(504, new { message = "The website took too long to respond (504)." });
                    default:
                        return BadRequest(new { message = $"HTTP error: {ex.Message}" });
                }
            }

            var discoveredUrls = new List<string>();
            var content = new StringBuilder();

            try
            {
                // First, do a discovery pass to find all URLs without processing content
                var allUrls = new HashSet<string>();
                await DiscoverUrlsAsync(
                    httpClient,
                    request.Url,
                    allUrls,
                    request.CrawlSubpages,
                    request.MaxDepth,
                    request.RespectRobotsTxt
                );
                
                // Convert to list and add the initial URL if not present
                if (!allUrls.Contains(request.Url))
                    allUrls.Add(request.Url);
                    
                var urlsList = allUrls.ToList();
                int totalUrls = urlsList.Count;
                int processedCount = 0;
                
                // Make sure to add all discovered URLs to the discoveredUrls list
                // This ensures they're returned in the API response
                discoveredUrls.AddRange(urlsList);
                
                _logger.LogInformation("Discovered {Count} URLs to crawl", totalUrls);
                
                // Now process each URL one by one with gradual progress updates
                foreach (var url in urlsList)
                {
                    // Update progress for each URL
                    processedCount++;
                    _currentProgress.CurrentUrl = url;
                    _currentProgress.DiscoveredUrlsCount = totalUrls;
                    _currentProgress.ProcessedUrlsCount = processedCount;
                    _currentProgress.CurrentAction = $"Processing {processedCount} of {totalUrls}";
                    
                    // Calculate progress percentage (0-95% during processing)
                    _currentProgress.Progress = Math.Min(95, (int)((processedCount * 95.0) / totalUrls));
                    
                    // Send progress update via SignalR
                    await _hubContext.Clients.All.SendAsync("CrawlProgressUpdate", _currentProgress);
                    
                    // Process this URL
                    await ProcessUrlContentAsync(
                        httpClient,
                        url,
                        content,
                        request.ExcludeNavigation
                    );
                }

                _currentProgress.Progress = 100;
                _currentProgress.CurrentAction = "Crawl completed";
            
                // Send final progress update via SignalR
                await _hubContext.Clients.All.SendAsync("CrawlProgressUpdate", _currentProgress);

                _logger.LogInformation("Completed crawl of website: {Url}", request.Url);

                var extractedContent = content.ToString();
                if (string.IsNullOrWhiteSpace(extractedContent))
                {
                    return BadRequest(new { message = "No content could be extracted from the provided URL. The page might be empty or require JavaScript to load content." });
                }

                // Create and save document
                var document = new Document
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    Name = uri.Host + uri.AbsolutePath,
                    Type = "website",
                    Content = extractedContent,
                    Size = Encoding.UTF8.GetByteCount(extractedContent),
                    UploadDate = DateTime.UtcNow,
                    Status = "indexed",
                    Metadata = System.Text.Json.JsonSerializer.Serialize(new
                    {
                        BaseUrl = request.Url,
                        CrawledUrls = discoveredUrls,
                        CrawlDepth = request.MaxDepth,
                        ExcludedNavigation = request.ExcludeNavigation
                    })
                };

                _context.Documents.Add(document);
                await _context.SaveChangesAsync();

                return Ok(new CrawlWebsiteResponse
                {
                    Content = extractedContent,
                    DiscoveredUrls = discoveredUrls.Distinct().ToList(),
                    DocumentId = document.Id,
                    Progress = _currentProgress
                });
            }
            catch (WebsiteCrawlException ex)
            {
                return StatusCode((int)ex.StatusCode, new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error crawling website: {Url}", request.Url);
                return StatusCode(500, new { message = "An unexpected error occurred while crawling the website. Please try again later." });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled error in CrawlWebsite endpoint");
            return StatusCode(500, new { message = "An unexpected error occurred. Please try again later." });
        }
    }

    private async Task CrawlPageAsync(
        HttpClient httpClient, 
        string url, 
        StringBuilder contentBuilder, 
        List<string> discoveredUrls, 
        bool crawlSubpages, 
        int maxDepth, 
        bool excludeNavigation,
        bool respectRobotsTxt,
        int currentDepth = 0,
        HashSet<string>? visitedUrls = null)
    {
        if (currentDepth > maxDepth)
        {
            return;
        }

        // Initialize visited URLs tracking if this is the first call
        visitedUrls ??= new HashSet<string>();

        // Skip if we've already visited this URL
        if (visitedUrls.Contains(url))
        {
            return;
        }

        // Mark this URL as visited
        visitedUrls.Add(url);

        _currentProgress.CurrentUrl = url;
        _currentProgress.CurrentAction = $"Analyzing page at depth {currentDepth}";

        _logger.LogInformation("Crawling page: {Url} at depth {Depth}", url, currentDepth);

        try
        {
            if (respectRobotsTxt)
            {
                _currentProgress.CurrentAction = "Checking robots.txt...";
                var uri = new Uri(url);
                var robotsUrl = new Uri(uri, "/robots.txt");
                
                try
                {
                    var robotsResponse = await httpClient.GetAsync(robotsUrl);
                    if (robotsResponse.IsSuccessStatusCode)
                    {
                        var robotsContent = await robotsResponse.Content.ReadAsStringAsync();
                        if (robotsContent.Contains("Disallow: " + new Uri(url).PathAndQuery))
                        {
                            throw new WebsiteCrawlException($"Access to {url} is disallowed by robots.txt", HttpStatusCode.Forbidden);
                        }
                    }
                }
                catch (HttpRequestException)
                {
                    // If robots.txt doesn't exist or can't be fetched, continue with the crawl
                }
            }

            _currentProgress.CurrentAction = "Fetching page content...";
            var response = await httpClient.GetAsync(url);
            
            // Handle various HTTP status codes
            if (!response.IsSuccessStatusCode)
            {
                throw new WebsiteCrawlException(
                    $"Failed to access {url}: {(int)response.StatusCode} {response.ReasonPhrase}",
                    response.StatusCode
                );
            }

            _currentProgress.CurrentAction = "Processing page content...";
            var html = await response.Content.ReadAsStringAsync();
            var doc = new HtmlDocument();
            doc.LoadHtml(html);

            // Check content type
            var contentType = response.Content.Headers.ContentType?.MediaType;
            if (contentType != null && !contentType.Contains("text/html"))
            {
                throw new WebsiteCrawlException($"URL {url} is not an HTML page (Content-Type: {contentType})", HttpStatusCode.UnsupportedMediaType);
            }

            _currentProgress.CurrentAction = "Extracting text content...";
            var pageContent = ExtractTextContent(doc, excludeNavigation);
            if (!string.IsNullOrWhiteSpace(pageContent))
            {
                contentBuilder.AppendLine($"--- Content from {url} ---");
                contentBuilder.AppendLine(pageContent);
                contentBuilder.AppendLine();
                
                // Only add to discovered URLs if not already there
                if (!discoveredUrls.Contains(url))
                {
                    discoveredUrls.Add(url);
                }
                
                // Update progress tracking
                _currentProgress.CurrentUrl = url;
                _currentProgress.DiscoveredUrlsCount = discoveredUrls.Count;
                _currentProgress.ProcessedUrlsCount = visitedUrls.Count;
                _currentProgress.CurrentAction = "Extracting content...";
                
                // Calculate progress as a percentage of visited URLs compared to total discovered URLs
                // Start with a small percentage and gradually increase as we process more URLs
                // Ensure we don't go above 95% until completely done
                int progressPercentage;
                
                if (discoveredUrls.Count > 0)
                {
                    // Calculate progress based on how many URLs we've visited compared to how many we've discovered
                    progressPercentage = (int)((visitedUrls.Count * 100.0) / Math.Max(1, discoveredUrls.Count));
                    
                    // Cap at 95% until completely done
                    progressPercentage = Math.Min(95, progressPercentage);
                }
                else
                {
                    // If we haven't discovered any URLs yet, show a small percentage
                    progressPercentage = 5;
                }
                
                _currentProgress.Progress = progressPercentage;
            
                // Send progress update via SignalR
                await _hubContext.Clients.All.SendAsync("CrawlProgressUpdate", _currentProgress);
            }

            if (crawlSubpages && currentDepth < maxDepth)
            {
                _currentProgress.CurrentAction = "Discovering links...";
                var links = doc.DocumentNode.SelectNodes("//a[@href]");
                if (links != null)
                {
                    var baseUri = new Uri(url);
                    foreach (var link in links)
                    {
                        try
                        {
                            string href = link.GetAttributeValue("href", "");
                            if (string.IsNullOrEmpty(href) || href.StartsWith("#") || 
                                href.StartsWith("javascript:") || href.StartsWith("mailto:"))
                            {
                                continue;
                            }

                            if (Uri.TryCreate(baseUri, href, out Uri? resolvedUri) && resolvedUri != null)
                            {
                                if (resolvedUri.Host == baseUri.Host)
                                {
                                    string normalizedUrl = resolvedUri.GetLeftPart(UriPartial.Path);
                                    if (!discoveredUrls.Contains(normalizedUrl))
                                    {
                                        _currentProgress.DiscoveredUrlsCount++;
                                        // Add to discovered URLs list first
                                        if (!discoveredUrls.Contains(normalizedUrl))
                                        {
                                            discoveredUrls.Add(normalizedUrl);
                                            _currentProgress.DiscoveredUrlsCount = discoveredUrls.Count;
                                            
                                            // Send a progress update when we discover a new URL
                                            _currentProgress.CurrentAction = $"Discovered: {normalizedUrl}";
                                            await _hubContext.Clients.All.SendAsync("CrawlProgressUpdate", _currentProgress);
                                        }
                                        
                                        // Then crawl the page
                                        await CrawlPageAsync(
                                            httpClient, 
                                            normalizedUrl, 
                                            contentBuilder, 
                                            discoveredUrls, 
                                            crawlSubpages, 
                                            maxDepth, 
                                            excludeNavigation, 
                                            respectRobotsTxt, 
                                            currentDepth + 1,
                                            visitedUrls
                                        );
                                    }
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Error processing link on page {Url}", url);
                        }
                    }
                }
            }
        }
        catch (HttpRequestException ex)
        {
            var message = ex.InnerException switch
            {
                SocketException se => se.SocketErrorCode switch
                {
                    SocketError.HostNotFound => $"Host not found: {url}",
                    SocketError.ConnectionRefused => $"Connection refused: {url}",
                    SocketError.TimedOut => $"Connection timed out: {url}",
                    _ => $"Network error accessing {url}: {se.Message}"
                },
                _ => $"HTTP error accessing {url}: {ex.Message}"
            };
            
            throw new WebsiteCrawlException(message, ex.StatusCode ?? HttpStatusCode.BadRequest);
        }
        catch (TaskCanceledException)
        {
            throw new WebsiteCrawlException($"Request timed out while crawling {url}", HttpStatusCode.GatewayTimeout);
        }
        catch (WebsiteCrawlException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error crawling page: {Url}", url);
            throw new WebsiteCrawlException($"Failed to crawl {url}: {ex.Message}", HttpStatusCode.InternalServerError);
        }
    }

    private string ExtractTextContent(HtmlDocument doc, bool excludeNavigation)
    {
        StringBuilder content = new StringBuilder();

        // First, try to get the main content
        var mainContent = doc.DocumentNode.SelectNodes("//main") ?? 
                          doc.DocumentNode.SelectNodes("//article") ??
                          doc.DocumentNode.SelectNodes("//div[@id='content']") ??
                          doc.DocumentNode.SelectNodes("//div[@class='content']");

        if (mainContent != null)
        {
            foreach (var node in mainContent)
            {
                content.AppendLine(ExtractNodeText(node));
            }
        }
        else
        {
            // Remove unwanted elements if specified
            if (excludeNavigation)
            {
                // Remove navigation, header, footer, sidebar, etc.
                var nodesToRemove = doc.DocumentNode.SelectNodes("//nav|//header|//footer|//aside|//div[contains(@class, 'nav')]|//div[contains(@class, 'menu')]|//div[contains(@class, 'footer')]");
                if (nodesToRemove != null)
                {
                    foreach (var node in nodesToRemove)
                    {
                        node.Remove();
                    }
                }
            }

            // Extract text from body or html if no main content was found
            var body = doc.DocumentNode.SelectSingleNode("//body") ?? doc.DocumentNode;
            content.AppendLine(ExtractNodeText(body));
        }

        return content.ToString();
    }

    private string ExtractNodeText(HtmlNode node)
    {
        StringBuilder sb = new StringBuilder();

        foreach (var childNode in node.ChildNodes)
        {
            if (childNode.NodeType == HtmlNodeType.Text)
            {
                string text = childNode.InnerText.Trim();
                if (!string.IsNullOrWhiteSpace(text))
                {
                    sb.AppendLine(text);
                }
            }
            else if (childNode.Name == "p" || childNode.Name == "h1" || childNode.Name == "h2" || 
                     childNode.Name == "h3" || childNode.Name == "h4" || childNode.Name == "h5" || 
                     childNode.Name == "h6" || childNode.Name == "li")
            {
                string text = childNode.InnerText.Trim();
                if (!string.IsNullOrWhiteSpace(text))
                {
                    sb.AppendLine(text);
                }
            }
            else
            {
                sb.Append(ExtractNodeText(childNode));
            }
        }

        return sb.ToString();
    }

    /// <summary>
    /// Discovers all URLs linked from a starting URL without processing content
    /// </summary>
    private async Task DiscoverUrlsAsync(
        HttpClient httpClient,
        string startUrl,
        HashSet<string> discoveredUrls,
        bool crawlSubpages,
        int maxDepth,
        bool respectRobotsTxt,
        int currentDepth = 0)
    {
        if (currentDepth > maxDepth || discoveredUrls.Contains(startUrl))
        {
            return;
        }
        
        // Add this URL to discovered URLs
        discoveredUrls.Add(startUrl);
        
        // Update progress
        _currentProgress.CurrentUrl = startUrl;
        _currentProgress.CurrentAction = $"Discovering links at depth {currentDepth}";
        _currentProgress.DiscoveredUrlsCount = discoveredUrls.Count;
        
        // Send progress update
        await _hubContext.Clients.All.SendAsync("CrawlProgressUpdate", _currentProgress);
        
        // If we're not crawling subpages or we've reached max depth, stop here
        if (!crawlSubpages || currentDepth >= maxDepth)
        {
            return;
        }
        
        try
        {
            // Check robots.txt if needed
            if (respectRobotsTxt)
            {
                var uri = new Uri(startUrl);
                var robotsUrl = new Uri(uri, "/robots.txt");
                
                try
                {
                    var robotsResponse = await httpClient.GetAsync(robotsUrl);
                    if (robotsResponse.IsSuccessStatusCode)
                    {
                        var robotsContent = await robotsResponse.Content.ReadAsStringAsync();
                        if (robotsContent.Contains("Disallow: " + new Uri(startUrl).PathAndQuery))
                        {
                            return; // Skip this URL
                        }
                    }
                }
                catch (HttpRequestException)
                {
                    // If robots.txt doesn't exist or can't be fetched, continue
                }
            }
            
            // Get the page content
            var response = await httpClient.GetAsync(startUrl);
            if (!response.IsSuccessStatusCode)
            {
                return; // Skip this URL if we can't access it
            }
            
            // Check content type
            var contentType = response.Content.Headers.ContentType?.MediaType;
            if (contentType == null || !contentType.Contains("text/html"))
            {
                return; // Skip non-HTML content
            }
            
            // Parse HTML and find links
            var html = await response.Content.ReadAsStringAsync();
            var doc = new HtmlDocument();
            doc.LoadHtml(html);
            
            var links = doc.DocumentNode.SelectNodes("//a[@href]");
            if (links != null)
            {
                var baseUri = new Uri(startUrl);
                foreach (var link in links)
                {
                    try
                    {
                        string href = link.GetAttributeValue("href", "");
                        if (string.IsNullOrEmpty(href) || href.StartsWith("#") || 
                            href.StartsWith("javascript:") || href.StartsWith("mailto:"))
                        {
                            continue;
                        }

                        if (Uri.TryCreate(baseUri, href, out Uri? resolvedUri) && resolvedUri != null)
                        {
                            if (resolvedUri.Host == baseUri.Host)
                            {
                                string normalizedUrl = resolvedUri.GetLeftPart(UriPartial.Path);
                                if (!discoveredUrls.Contains(normalizedUrl))
                                {
                                    // Recursively discover links from this URL
                                    await DiscoverUrlsAsync(
                                        httpClient,
                                        normalizedUrl,
                                        discoveredUrls,
                                        crawlSubpages,
                                        maxDepth,
                                        respectRobotsTxt,
                                        currentDepth + 1
                                    );
                                }
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Error processing link on page {Url}", startUrl);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error discovering links on page {Url}", startUrl);
        }
    }
    
    /// <summary>
    /// Processes a single URL and extracts its content
    /// </summary>
    private async Task ProcessUrlContentAsync(
        HttpClient httpClient,
        string url,
        StringBuilder contentBuilder,
        bool excludeNavigation)
    {
        try
        {
            // Get the page content
            var response = await httpClient.GetAsync(url);
            if (!response.IsSuccessStatusCode)
            {
                return; // Skip this URL if we can't access it
            }
            
            // Check content type
            var contentType = response.Content.Headers.ContentType?.MediaType;
            if (contentType == null || !contentType.Contains("text/html"))
            {
                return; // Skip non-HTML content
            }
            
            // Parse HTML and extract content
            var html = await response.Content.ReadAsStringAsync();
            var doc = new HtmlDocument();
            doc.LoadHtml(html);
            
            var pageContent = ExtractTextContent(doc, excludeNavigation);
            if (!string.IsNullOrWhiteSpace(pageContent))
            {
                contentBuilder.AppendLine($"--- Content from {url} ---");
                contentBuilder.AppendLine(pageContent);
                contentBuilder.AppendLine();
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error processing content on page {Url}", url);
        }
    }
    
    private bool TryGetCurrentUserId(out Guid userId)
    {
        userId = Guid.Empty;
        
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out userId))
        {
            return false;
        }
        
        return true;
    }
}

public class CrawlWebsiteRequest
{
    public required string Url { get; set; }
    public bool CrawlSubpages { get; set; } = true;
    public int MaxDepth { get; set; } = 2;
    public bool ExcludeNavigation { get; set; } = true;
    public bool RespectRobotsTxt { get; set; } = true;
}

public class CrawlWebsiteResponse
{
    public required string Content { get; set; }
    public required List<string> DiscoveredUrls { get; set; }
    public Guid DocumentId { get; set; }
    public CrawlProgressUpdate Progress { get; set; }
}