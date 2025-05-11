-- SQL script to add the missing columns to the Documents table
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Documents' AND COLUMN_NAME = 'OriginalFileName'
)
BEGIN
    ALTER TABLE Documents ADD OriginalFileName NVARCHAR(500) NULL;
    PRINT 'Added OriginalFileName column to Documents table';
END
ELSE
BEGIN
    PRINT 'OriginalFileName column already exists';
END

IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Documents' AND COLUMN_NAME = 'ContentType'
)
BEGIN
    ALTER TABLE Documents ADD ContentType NVARCHAR(100) NULL;
    PRINT 'Added ContentType column to Documents table';
END
ELSE
BEGIN
    PRINT 'ContentType column already exists';
END 