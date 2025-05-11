-- List the columns in the Users table
SELECT 
    c.name AS ColumnName,
    t.name AS DataType,
    c.max_length AS MaxLength,
    c.is_nullable AS IsNullable
FROM 
    sys.columns c
JOIN 
    sys.types t ON c.system_type_id = t.system_type_id
WHERE 
    c.object_id = OBJECT_ID('dbo.Users')
ORDER BY 
    c.column_id; 