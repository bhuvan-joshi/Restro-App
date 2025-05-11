-- Check if the Documents table exists
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Documents')
BEGIN
    -- Check if Embeddings column exists, if not add it
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name = N'Embeddings' AND Object_ID = Object_ID(N'Documents'))
    BEGIN
        ALTER TABLE [dbo].[Documents]
        ADD [Embeddings] [nvarchar](max) NULL;
        
        PRINT 'Added Embeddings column to Documents table'
    END
    ELSE
    BEGIN
        PRINT 'Embeddings column already exists'
    END
    
    -- Check if Metadata column exists, if not add it
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name = N'Metadata' AND Object_ID = Object_ID(N'Documents'))
    BEGIN
        ALTER TABLE [dbo].[Documents]
        ADD [Metadata] [nvarchar](max) NULL;
        
        PRINT 'Added Metadata column to Documents table'
    END
    ELSE
    BEGIN
        PRINT 'Metadata column already exists'
    END
    
    -- Add migration history record if not exists
    IF NOT EXISTS (SELECT 1 FROM [__EFMigrationsHistory] WHERE [MigrationId] = '20250428104522_AddMissingDocumentColumns')
    BEGIN
        INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
        VALUES ('20250428104522_AddMissingDocumentColumns', '7.0.11')
        
        PRINT 'Added migration history record'
    END
END
ELSE
BEGIN
    PRINT 'Documents table does not exist'
END 