-- Update a widget's behavior fields
-- First, let's get the ID of a widget to update
DECLARE @WidgetId uniqueidentifier;

-- Get the first widget's ID
SELECT TOP 1 @WidgetId = Id FROM WidgetSettings;

-- Check if we found a widget
IF @WidgetId IS NULL
BEGIN
    PRINT 'No widgets found to update!';
    RETURN;
END

-- Update the widget's behavior fields
UPDATE WidgetSettings
SET 
    CollectUserFeedback = 0,   -- Set to false
    IsOfflineMode = 1,         -- Set to true
    OfflineMessage = 'Updated offline message from SQL script',
    RequireEmailToStart = 1,   -- Set to true
    ShowSources = 0            -- Set to false
WHERE 
    Id = @WidgetId;

PRINT 'Updated widget with ID: ' + CONVERT(VARCHAR(36), @WidgetId);

-- Check the update worked
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