-- Check if Documents table exists, if not, create it
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Documents')
BEGIN
    CREATE TABLE [dbo].[Documents](
        [Id] [uniqueidentifier] NOT NULL PRIMARY KEY,
        [UserId] [uniqueidentifier] NOT NULL,
        [Name] [nvarchar](255) NOT NULL,
        [Type] [nvarchar](50) NOT NULL,
        [Size] [bigint] NOT NULL,
        [Content] [nvarchar](max) NULL,
        [UploadDate] [datetime2](7) NOT NULL,
        [Status] [nvarchar](50) NOT NULL,
        [FileUrl] [nvarchar](500) NULL,
        [ErrorMessage] [nvarchar](500) NULL,
        [Embeddings] [nvarchar](max) NULL,
        [Metadata] [nvarchar](max) NULL,
        CONSTRAINT [FK_Documents_Users] FOREIGN KEY([UserId])
        REFERENCES [dbo].[Users] ([Id])
        ON DELETE CASCADE
    )
    
    PRINT 'Documents table created successfully'
END
ELSE
BEGIN
    PRINT 'Documents table already exists'
END

-- Add migration history record if not exists
IF NOT EXISTS (SELECT 1 FROM [__EFMigrationsHistory] WHERE [MigrationId] = '20250427081635_AddDocumentsTable')
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES ('20250427081635_AddDocumentsTable', '7.0.11')
    
    PRINT 'Added migration history record'
END
ELSE
BEGIN
    PRINT 'Migration history record already exists'
END 