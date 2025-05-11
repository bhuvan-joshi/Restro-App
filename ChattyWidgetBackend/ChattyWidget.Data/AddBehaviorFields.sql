IF OBJECT_ID(N'[__EFMigrationsHistory]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250423033648_InitialCreate'
)
BEGIN
    CREATE TABLE [Users] (
        [Id] uniqueidentifier NOT NULL,
        [Username] nvarchar(100) NOT NULL,
        [Email] nvarchar(100) NOT NULL,
        [PasswordHash] nvarchar(max) NOT NULL,
        [Role] nvarchar(50) NOT NULL DEFAULT N'user',
        [CreatedAt] datetime2 NOT NULL,
        [LastLoginAt] datetime2 NULL,
        CONSTRAINT [PK_Users] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250423033648_InitialCreate'
)
BEGIN
    CREATE TABLE [Documents] (
        [Id] uniqueidentifier NOT NULL,
        [Name] nvarchar(255) NOT NULL,
        [Type] nvarchar(50) NOT NULL,
        [Size] bigint NOT NULL,
        [Content] nvarchar(max) NOT NULL,
        [UploadDate] datetime2 NOT NULL,
        [Status] nvarchar(50) NOT NULL,
        [FileUrl] nvarchar(max) NULL,
        [ErrorMessage] nvarchar(max) NULL,
        [UserId] uniqueidentifier NOT NULL,
        CONSTRAINT [PK_Documents] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Documents_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250423033648_InitialCreate'
)
BEGIN
    CREATE TABLE [WidgetSettings] (
        [Id] uniqueidentifier NOT NULL,
        [UserId] uniqueidentifier NOT NULL,
        [BotName] nvarchar(100) NOT NULL,
        [WelcomeMessage] nvarchar(500) NOT NULL,
        [PrimaryColor] nvarchar(max) NOT NULL,
        [Position] nvarchar(20) NOT NULL,
        [ModelId] nvarchar(max) NULL,
        [SiteName] nvarchar(100) NULL,
        [SiteDescription] nvarchar(255) NULL,
        [PrimaryContent] nvarchar(max) NULL,
        [CustomKnowledge] nvarchar(max) NULL,
        [IsActive] bit NOT NULL,
        [AllowedDomains] nvarchar(max) NOT NULL,
        [LogoUrl] nvarchar(max) NULL,
        [CustomCSS] nvarchar(max) NULL,
        [TrackingEnabled] bit NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NULL,
        CONSTRAINT [PK_WidgetSettings] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_WidgetSettings_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250423033648_InitialCreate'
)
BEGIN
    CREATE TABLE [ChatSessions] (
        [Id] uniqueidentifier NOT NULL,
        [UserId] uniqueidentifier NOT NULL,
        [WidgetId] uniqueidentifier NOT NULL,
        [SessionIdentifier] nvarchar(max) NOT NULL,
        [StartedAt] datetime2 NOT NULL,
        [EndedAt] datetime2 NULL,
        [UserLocation] nvarchar(max) NULL,
        [UserDevice] nvarchar(max) NULL,
        [ReferrerUrl] nvarchar(max) NULL,
        CONSTRAINT [PK_ChatSessions] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_ChatSessions_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_ChatSessions_WidgetSettings_WidgetId] FOREIGN KEY ([WidgetId]) REFERENCES [WidgetSettings] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250423033648_InitialCreate'
)
BEGIN
    CREATE TABLE [ChatMessages] (
        [Id] uniqueidentifier NOT NULL,
        [SessionId] uniqueidentifier NOT NULL,
        [Content] nvarchar(max) NOT NULL,
        [IsFromUser] bit NOT NULL,
        [Timestamp] datetime2 NOT NULL,
        [ModelUsed] nvarchar(max) NULL,
        [TokenCount] int NULL,
        [SourceDocumentIds] nvarchar(max) NULL,
        CONSTRAINT [PK_ChatMessages] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_ChatMessages_ChatSessions_SessionId] FOREIGN KEY ([SessionId]) REFERENCES [ChatSessions] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250423033648_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_ChatMessages_SessionId] ON [ChatMessages] ([SessionId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250423033648_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_ChatSessions_UserId] ON [ChatSessions] ([UserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250423033648_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_ChatSessions_WidgetId] ON [ChatSessions] ([WidgetId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250423033648_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Documents_UserId] ON [Documents] ([UserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250423033648_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_WidgetSettings_UserId] ON [WidgetSettings] ([UserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250423033648_InitialCreate'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20250423033648_InitialCreate', N'9.0.4');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250427065120_AddBehaviorFields'
)
BEGIN
    ALTER TABLE [WidgetSettings] ADD [CollectUserFeedback] bit NOT NULL DEFAULT CAST(0 AS bit);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250427065120_AddBehaviorFields'
)
BEGIN
    ALTER TABLE [WidgetSettings] ADD [IsOfflineMode] bit NOT NULL DEFAULT CAST(0 AS bit);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250427065120_AddBehaviorFields'
)
BEGIN
    ALTER TABLE [WidgetSettings] ADD [OfflineMessage] nvarchar(500) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250427065120_AddBehaviorFields'
)
BEGIN
    ALTER TABLE [WidgetSettings] ADD [RequireEmailToStart] bit NOT NULL DEFAULT CAST(0 AS bit);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250427065120_AddBehaviorFields'
)
BEGIN
    ALTER TABLE [WidgetSettings] ADD [ShowSources] bit NOT NULL DEFAULT CAST(0 AS bit);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250427065120_AddBehaviorFields'
)
BEGIN
    DECLARE @var sysname;
    SELECT @var = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Users]') AND [c].[name] = N'Role');
    IF @var IS NOT NULL EXEC(N'ALTER TABLE [Users] DROP CONSTRAINT [' + @var + '];');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250427065120_AddBehaviorFields'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20250427065120_AddBehaviorFields', N'9.0.4');
END;

COMMIT;
GO

