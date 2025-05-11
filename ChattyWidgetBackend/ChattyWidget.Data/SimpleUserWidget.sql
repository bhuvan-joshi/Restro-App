-- Insert a simple user and widget with behavior data
DECLARE @UserId uniqueidentifier = NEWID();

-- Insert user without Role column
INSERT INTO Users (Id, Username, Email, PasswordHash, CreatedAt)
VALUES (@UserId, 'testuser', 'test@example.com', 'hashedpassword', GETDATE());

-- Insert widget with behavior fields
DECLARE @WidgetId uniqueidentifier = NEWID();
INSERT INTO WidgetSettings (
    Id, 
    UserId, 
    BotName,
    WelcomeMessage,
    PrimaryColor,
    Position,
    IsActive, 
    AllowedDomains,
    TrackingEnabled,
    CreatedAt,
    CollectUserFeedback,
    IsOfflineMode,
    OfflineMessage,
    RequireEmailToStart,
    ShowSources
)
VALUES (
    @WidgetId,
    @UserId,
    'Test Bot',
    'Hello, I am a test bot!',
    '#3498db',
    'bottom-right',
    1,
    '*',
    1,
    GETDATE(),
    1,  -- CollectUserFeedback = true
    1,  -- IsOfflineMode = true
    'Sorry, we are offline right now.',
    1,  -- RequireEmailToStart = true
    1   -- ShowSources = true
);

-- Output the widget data
SELECT 
    Id,
    UserId,
    BotName,
    CollectUserFeedback,
    IsOfflineMode,
    OfflineMessage,
    RequireEmailToStart,
    ShowSources
FROM 
    WidgetSettings
WHERE 
    Id = @WidgetId; 