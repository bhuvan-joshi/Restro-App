-- Insert a test widget with behavior data
DECLARE @UserId uniqueidentifier = NEWID(); -- Generating a new user ID for this test

-- First make sure we have a user
IF NOT EXISTS (SELECT * FROM Users WHERE Id = @UserId)
BEGIN
    INSERT INTO Users (Id, Username, Email, PasswordHash, Role, CreatedAt)
    VALUES (@UserId, 'testuser', 'test@example.com', 'hashedpassword', 'user', GETDATE());
    PRINT 'Created test user with ID: ' + CONVERT(VARCHAR(36), @UserId);
END

-- Now insert a widget with behavior data
DECLARE @WidgetId uniqueidentifier = NEWID();
INSERT INTO WidgetSettings (
    Id,
    UserId,
    BotName,
    WelcomeMessage,
    PrimaryColor,
    Position,
    ModelId,
    IsActive,
    AllowedDomains,
    TrackingEnabled,
    CreatedAt,
    -- Behavior fields
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
    'Welcome to the test bot!',
    '#3498db',
    'bottom-right',
    'llama-3-small',
    1, -- IsActive = true
    '*',
    1, -- TrackingEnabled = true
    GETDATE(),
    -- Behavior field values
    1, -- CollectUserFeedback = true
    1, -- IsOfflineMode = true
    'Sorry, we are currently offline. Please leave a message.',
    1, -- RequireEmailToStart = true
    1  -- ShowSources = true
);

PRINT 'Created test widget with ID: ' + CONVERT(VARCHAR(36), @WidgetId);
PRINT 'Behavior fields set: CollectUserFeedback=true, IsOfflineMode=true, RequireEmailToStart=true, ShowSources=true';

-- Verify the widget was created with behavior data
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