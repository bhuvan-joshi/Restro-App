-- Simple script to check if behavior fields exist
SELECT 
    CASE WHEN COL_LENGTH('WidgetSettings', 'CollectUserFeedback') IS NOT NULL THEN 'Exists' ELSE 'Missing' END AS CollectUserFeedback,
    CASE WHEN COL_LENGTH('WidgetSettings', 'IsOfflineMode') IS NOT NULL THEN 'Exists' ELSE 'Missing' END AS IsOfflineMode,
    CASE WHEN COL_LENGTH('WidgetSettings', 'OfflineMessage') IS NOT NULL THEN 'Exists' ELSE 'Missing' END AS OfflineMessage,
    CASE WHEN COL_LENGTH('WidgetSettings', 'RequireEmailToStart') IS NOT NULL THEN 'Exists' ELSE 'Missing' END AS RequireEmailToStart,
    CASE WHEN COL_LENGTH('WidgetSettings', 'ShowSources') IS NOT NULL THEN 'Exists' ELSE 'Missing' END AS ShowSources; 