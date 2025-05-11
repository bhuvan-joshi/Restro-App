-- Add columns to Documents table if they don't exist
IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = 'EmbeddingVector' AND Object_ID = Object_ID('Documents'))
BEGIN
    ALTER TABLE Documents
    ADD EmbeddingVector NVARCHAR(MAX) NULL;
END

IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = 'IsEmbeddingProcessed' AND Object_ID = Object_ID('Documents'))
BEGIN
    ALTER TABLE Documents
    ADD IsEmbeddingProcessed BIT NOT NULL DEFAULT 0;
END

-- Create DocumentChunks table if it doesn't exist
IF NOT EXISTS(SELECT * FROM sys.tables WHERE Name = 'DocumentChunks')
BEGIN
    CREATE TABLE DocumentChunks
    (
        Id UNIQUEIDENTIFIER PRIMARY KEY NOT NULL,
        DocumentId UNIQUEIDENTIFIER NOT NULL,
        Content NVARCHAR(MAX) NOT NULL,
        EmbeddingVector NVARCHAR(MAX) NULL,
        ChunkIndex INT NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_DocumentChunks_Documents FOREIGN KEY (DocumentId) 
            REFERENCES Documents(Id) ON DELETE CASCADE
    );

    CREATE INDEX IX_DocumentChunks_DocumentId ON DocumentChunks(DocumentId);
END 