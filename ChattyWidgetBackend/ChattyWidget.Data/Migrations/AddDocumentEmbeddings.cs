using Microsoft.EntityFrameworkCore.Migrations;
using System;

namespace ChattyWidget.Data.Migrations
{
    public partial class AddDocumentEmbeddings : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Add vector storage columns to Documents table
            migrationBuilder.AddColumn<string>(
                name: "EmbeddingVector",
                table: "Documents",
                type: "nvarchar(max)",
                nullable: true);
                
            migrationBuilder.AddColumn<bool>(
                name: "IsEmbeddingProcessed",
                table: "Documents",
                type: "bit",
                nullable: false,
                defaultValue: false);
                
            // Add a new table for document chunks with embeddings
            migrationBuilder.CreateTable(
                name: "DocumentChunks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DocumentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Content = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    EmbeddingVector = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ChunkIndex = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DocumentChunks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DocumentChunks_Documents_DocumentId",
                        column: x => x.DocumentId,
                        principalTable: "Documents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });
                
            migrationBuilder.CreateIndex(
                name: "IX_DocumentChunks_DocumentId",
                table: "DocumentChunks",
                column: "DocumentId");
                
            // Create stored procedure for vector similarity search
            // This uses cosine similarity calculation
            migrationBuilder.Sql(@"
CREATE OR ALTER PROCEDURE [dbo].[SearchSimilarDocumentChunks]
    @QueryVector NVARCHAR(MAX),
    @TopK INT = 5
AS
BEGIN
    -- Parse query vector from string to table of floats
    DECLARE @QueryVectorTable TABLE (
        [Index] INT IDENTITY(0, 1),
        [Value] FLOAT
    );
    
    -- Use a string splitting function to convert vector string to rows
    INSERT INTO @QueryVectorTable ([Value])
    SELECT value FROM STRING_SPLIT(REPLACE(@QueryVector, '[', '').REPLACE(']', ''), ',');
    
    -- Perform similarity search using dot product
    -- This calculates cosine similarity between query vector and stored vectors
    SELECT TOP (@TopK)
        c.Id,
        c.DocumentId,
        c.Content,
        c.ChunkIndex,
        d.Name AS DocumentName,
        (
            SELECT SUM(qv.[Value] * ev.[Value])
            FROM @QueryVectorTable qv
            CROSS APPLY (
                SELECT [Value], [Index]
                FROM OPENJSON((SELECT EmbeddingVector FROM DocumentChunks WHERE Id = c.Id))
                WITH ([Index] INT '$.Index', [Value] FLOAT '$.Value')
            ) ev
            WHERE qv.[Index] = ev.[Index]
        ) AS Similarity
    FROM 
        DocumentChunks c
        INNER JOIN Documents d ON c.DocumentId = d.Id
    WHERE 
        c.EmbeddingVector IS NOT NULL
    ORDER BY 
        Similarity DESC;
END
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DocumentChunks");
                
            migrationBuilder.DropColumn(
                name: "EmbeddingVector",
                table: "Documents");
                
            migrationBuilder.DropColumn(
                name: "IsEmbeddingProcessed",
                table: "Documents");
                
            migrationBuilder.Sql("DROP PROCEDURE IF EXISTS [dbo].[SearchSimilarDocumentChunks]");
        }
    }
} 