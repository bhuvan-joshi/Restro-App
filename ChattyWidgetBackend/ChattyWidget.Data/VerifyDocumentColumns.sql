-- Verify that all columns exist in the Documents table
SELECT 
    COLUMN_NAME, 
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH
FROM 
    INFORMATION_SCHEMA.COLUMNS
WHERE 
    TABLE_NAME = 'Documents'
ORDER BY 
    ORDINAL_POSITION; 