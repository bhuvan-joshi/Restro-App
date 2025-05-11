using Microsoft.AspNetCore.SignalR;

namespace ChattyWidget.API.Hubs;

public class CrawlProgressHub : Hub
{
    public async Task UpdateProgress(CrawlProgressUpdate progress)
    {
        await Clients.All.SendAsync("CrawlProgressUpdate", progress);
    }
}

public class CrawlProgressUpdate
{
    public string CurrentUrl { get; set; } = "";
    public int DiscoveredUrlsCount { get; set; }
    public int ProcessedUrlsCount { get; set; }
    public string CurrentAction { get; set; } = "";
    public int Progress { get; set; }
}