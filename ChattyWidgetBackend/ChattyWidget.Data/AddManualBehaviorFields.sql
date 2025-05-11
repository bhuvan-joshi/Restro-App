-- Add behavior fields to WidgetSettings table if they don't exist
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[WidgetSettings]') AND name = 'CollectUserFeedback')
BEGIN
    ALTER TABLE [WidgetSettings] ADD [CollectUserFeedback] bit NOT NULL DEFAULT CAST(0 AS bit);
    PRINT 'Added CollectUserFeedback column';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[WidgetSettings]') AND name = 'IsOfflineMode')
BEGIN
    ALTER TABLE [WidgetSettings] ADD [IsOfflineMode] bit NOT NULL DEFAULT CAST(0 AS bit);
    PRINT 'Added IsOfflineMode column';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[WidgetSettings]') AND name = 'OfflineMessage')
BEGIN
    ALTER TABLE [WidgetSettings] ADD [OfflineMessage] nvarchar(500) NULL;
    PRINT 'Added OfflineMessage column';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[WidgetSettings]') AND name = 'RequireEmailToStart')
BEGIN
    ALTER TABLE [WidgetSettings] ADD [RequireEmailToStart] bit NOT NULL DEFAULT CAST(0 AS bit);
    PRINT 'Added RequireEmailToStart column';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[WidgetSettings]') AND name = 'ShowSources')
BEGIN
    ALTER TABLE [WidgetSettings] ADD [ShowSources] bit NOT NULL DEFAULT CAST(0 AS bit);
    PRINT 'Added ShowSources column';
END

-- Update migration history table if it exists
IF EXISTS (SELECT * FROM sys.tables WHERE name = '__EFMigrationsHistory')
BEGIN
    IF NOT EXISTS (SELECT * FROM [__EFMigrationsHistory] WHERE [MigrationId] = N'20250427065120_AddBehaviorFields')
    BEGIN
        INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
        VALUES (N'20250427065120_AddBehaviorFields', N'9.0.4');
        PRINT 'Added migration history record';
    END
END 