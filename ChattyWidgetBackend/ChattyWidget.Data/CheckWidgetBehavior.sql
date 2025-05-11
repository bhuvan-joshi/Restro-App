-- Check the behavior fields on all widgets in a more readable format
SELECT 
    CONVERT(VARCHAR(36), Id) AS 'WidgetId',
    BotName,
    CASE WHEN CollectUserFeedback = 1 THEN 'True' ELSE 'False' END AS 'CollectUserFeedback',
    CASE WHEN IsOfflineMode = 1 THEN 'True' ELSE 'False' END AS 'IsOfflineMode',
    CASE WHEN LEN(OfflineMessage) > 20 
         THEN LEFT(OfflineMessage, 20) + '...' 
         ELSE OfflineMessage 
    END AS 'OfflineMessage',
    CASE WHEN RequireEmailToStart = 1 THEN 'True' ELSE 'False' END AS 'RequireEmailToStart',
    CASE WHEN ShowSources = 1 THEN 'True' ELSE 'False' END AS 'ShowSources'
FROM 
    WidgetSettings; 