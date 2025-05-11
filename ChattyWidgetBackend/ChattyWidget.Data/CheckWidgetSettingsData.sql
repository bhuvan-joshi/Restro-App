-- Check contents of WidgetSettings table, focusing on behavior fields
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
    WidgetSettings; 