using ChattyWidget.Core.DTOs;
using ChattyWidget.Core.Interfaces;
using ChattyWidget.Core.Services;
using ChattyWidget.Data;
using ChattyWidget.Data.Repositories;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using ChattyWidget.API.Hubs; // For CrawlProgressHub
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
    });

// Configure SQL Server
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        b => b.MigrationsAssembly("ChattyWidget.Data")));

// Configure Authentication
var jwtSection = builder.Configuration.GetSection("JWT");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSection["Issuer"],
            ValidAudience = jwtSection["Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSection["Secret"]))
        };
    });

// Register Repositories
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IWidgetRepository, WidgetRepository>();
builder.Services.AddScoped<IChatSessionRepository, ChatSessionRepository>();
builder.Services.AddScoped<IChatMessageRepository, ChatMessageRepository>();

// Register Services
var tokenLifetime = TimeSpan.FromHours(24);
builder.Services.AddSingleton(provider => new AuthService(
    jwtSection["Secret"],
    jwtSection["Issuer"],
    jwtSection["Audience"],
    tokenLifetime));
builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<WidgetService>();
builder.Services.AddScoped<ChatService>();
builder.Services.AddScoped<IDocumentRepository, DocumentRepository>();
builder.Services.AddScoped<IDocumentService, DocumentService>();

// Configure LLM Services
builder.Services.Configure<LlmProviderConfig>(builder.Configuration.GetSection("LlmProviders"));

// Register individual LLM service implementations
builder.Services.AddScoped<OpenAiLlmService>();
builder.Services.AddScoped<OllamaLlmService>();
builder.Services.AddScoped<AnthropicLlmService>();
builder.Services.AddScoped<DeepSeekLlmService>();

// Register user LLM preference repository and service
builder.Services.AddScoped<IUserLlmPreferenceRepository, UserLlmPreferenceRepository>();
builder.Services.AddScoped<IUserLlmPreferenceService, UserLlmPreferenceService>();

// Register the LLM service manager as the ILlmService implementation
builder.Services.AddScoped<ILlmService>(sp => 
{
    // Create a list of all LLM service implementations
    var services = new List<ILlmService>
    {
        sp.GetRequiredService<OpenAiLlmService>(),
        sp.GetRequiredService<OllamaLlmService>(),
        sp.GetRequiredService<AnthropicLlmService>(),
        sp.GetRequiredService<DeepSeekLlmService>()
    };
    
    // Return the composite manager service
    return new LlmServiceManager(services, sp.GetRequiredService<ILogger<LlmServiceManager>>());
});

// Register agent service after LLM service is registered
builder.Services.AddScoped<IAgentService, AgentService>();

// Register HttpClient for WebsiteController
builder.Services.AddHttpClient();

// Register SignalR
builder.Services.AddSignalR();

// Configure CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
    
    options.AddPolicy("AllowSpecificOrigins", policy =>
    {
        policy.WithOrigins(
                "http://localhost:9000",  // React development server
                "http://localhost:9016",  // React development server (alternate)
                "http://localhost:5173",  // Vite development server
                "http://localhost:5001",  // Previous backend server
                "https://localhost:5001", // Previous backend server (HTTPS)
                "http://127.0.0.1:54163") // Localhost proxy for browser preview
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });

  
});

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Add this to the service registration section, before building the app:
// Register HttpClient for Ollama embeddings and LLM API calls
builder.Services.AddHttpClient("OllamaClient", client =>
{
    client.BaseAddress = new Uri("http://localhost:11434/");
    client.Timeout = TimeSpan.FromMinutes(5); // Increased timeout for large models like DeepSeek
});

// Configure default HttpClient with longer timeout
builder.Services.AddHttpClient(Microsoft.Extensions.Options.Options.DefaultName, client =>
{
    client.Timeout = TimeSpan.FromMinutes(3); // Increased default timeout for all HTTP clients
});

// Register EmbeddingService with proper dependency injection
builder.Services.AddScoped<IEmbeddingService>(provider => 
    new EmbeddingService(
        provider.GetRequiredService<ApplicationDbContext>(),
        provider.GetRequiredService<ILogger<EmbeddingService>>(),
        provider.GetRequiredService<IHttpClientFactory>()
    )
);

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// app.UseHttpsRedirection();

// Enable serving static files
app.UseStaticFiles();

// Use CORS - update to use AllowFrontend policy
app.UseCors("AllowSpecificOrigins");

// Add authentication middleware
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Map SignalR CrawlProgressHub
app.MapHub<CrawlProgressHub>("/crawlProgressHub");

// Add widget css endpoint
app.MapGet("/widget.css", async (HttpContext context) =>
{
    context.Response.ContentType = "text/css";
    await context.Response.SendFileAsync(Path.Combine(app.Environment.WebRootPath, "css", "widget.css"));
});

// Add widget demo endpoint
app.MapGet("/widget", async (HttpContext context) =>
{
    await context.Response.SendFileAsync(Path.Combine(app.Environment.WebRootPath, "widget-demo.html"));
});

// Add document reprocessing endpoint
app.MapGet("/api/admin/reprocess-embeddings", async (HttpContext context, ApplicationDbContext dbContext, IEmbeddingService embeddingService, ILogger<Program> logger) =>
{
    try
    {
        // Get documents that need reprocessing
        var documents = await dbContext.Documents
            .Where(d => !d.IsEmbeddingProcessed && !string.IsNullOrEmpty(d.Content))
            .ToListAsync();
            
        logger.LogInformation($"Found {documents.Count} documents to reprocess");
        
        int processed = 0;
        
        // Process each document
        foreach (var document in documents)
        {
            try
            {
                await embeddingService.ProcessDocumentAsync(document.Id);
                processed++;
                logger.LogInformation($"Processed document {document.Id} - {document.Name}");
            }
            catch (Exception ex)
            {
                logger.LogError(ex, $"Error processing document {document.Id}");
            }
        }
        
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsync($"{{\"message\": \"Successfully reprocessed {processed} documents\", \"processedCount\": {processed}}}");
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Error reprocessing documents");
        context.Response.StatusCode = 500;
        await context.Response.WriteAsync($"{{\"error\": \"An error occurred while reprocessing documents: {ex.Message}\"}}");
    }
});

// Add endpoint to reset embedding processed flags
app.MapPost("/api/admin/reset-embedding-flags", async (HttpContext context, ApplicationDbContext dbContext, ILogger<Program> logger) =>
{
    try
    {
        // Get request parameters
        string documentIdParam = context.Request.Query["documentId"];
        string allParam = context.Request.Query["all"];
        
        bool resetAll = !string.IsNullOrEmpty(allParam) && (allParam.ToLower() == "true" || allParam == "1");
        Guid documentId = Guid.Empty;
        bool hasDocumentId = Guid.TryParse(documentIdParam, out documentId);
        
        int count = 0;
        
        if (resetAll)
        {
            // Reset all documents
            var documents = await dbContext.Documents.ToListAsync();
            foreach (var doc in documents)
            {
                doc.IsEmbeddingProcessed = false;
                count++;
            }
            
            // Clean up existing chunks
            var chunks = await dbContext.DocumentChunks.ToListAsync();
            dbContext.DocumentChunks.RemoveRange(chunks);
            
            await dbContext.SaveChangesAsync();
            logger.LogInformation($"Reset embedding flags for {count} documents and removed {chunks.Count} chunks");
        }
        else if (hasDocumentId)
        {
            // Reset specific document
            var document = await dbContext.Documents.FirstOrDefaultAsync(d => d.Id == documentId);
            if (document != null)
            {
                document.IsEmbeddingProcessed = false;
                count = 1;
                
                // Clean up existing chunks for this document
                var chunks = await dbContext.DocumentChunks.Where(c => c.DocumentId == documentId).ToListAsync();
                dbContext.DocumentChunks.RemoveRange(chunks);
                
                await dbContext.SaveChangesAsync();
                logger.LogInformation($"Reset embedding flag for document {documentId} and removed {chunks.Count} chunks");
            }
            else
            {
                context.Response.StatusCode = 404;
                await context.Response.WriteAsync($"{{\"error\": \"Document with ID {documentId} not found\"}}");
                return;
            }
        }
        else
        {
            context.Response.StatusCode = 400;
            await context.Response.WriteAsync("{\"error\": \"You must specify either 'all=true' or a valid 'documentId' parameter\"}");
            return;
        }
        
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsync($"{{\"message\": \"Successfully reset {count} documents\", \"count\": {count}}}");
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Error resetting embedding flags");
        context.Response.StatusCode = 500;
        await context.Response.WriteAsync($"{{\"error\": \"An error occurred while resetting embedding flags: {ex.Message}\"}}");
    }
});

// Ensure database is created
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<ApplicationDbContext>();
        var logger = services.GetRequiredService<ILogger<DataSeeder>>();
        
        // Ensure the database is created
        context.Database.EnsureCreated();
        
        // Seed initial data
        var seeder = new DataSeeder(context, logger);
        await seeder.SeedDataAsync();
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "An error occurred while initializing the database.");
    }
}

app.Run();
