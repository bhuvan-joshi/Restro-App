-- SQL script to update the EF Migrations history table

-- Create the EF Migrations history table if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[__EFMigrationsHistory]') AND type in (N'U'))
BEGIN
    CREATE TABLE [__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
    PRINT 'Created __EFMigrationsHistory table';
END

-- Add migration entries if they don't exist
IF NOT EXISTS (SELECT * FROM [__EFMigrationsHistory] WHERE [MigrationId] = '20250423033648_InitialCreate')
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES ('20250423033648_InitialCreate', '9.0.0');
    PRINT 'Added InitialCreate migration to history';
END

IF NOT EXISTS (SELECT * FROM [__EFMigrationsHistory] WHERE [MigrationId] = '20250427065744_AddBehaviorFieldsOnly')
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES ('20250427065744_AddBehaviorFieldsOnly', '9.0.0');
    PRINT 'Added AddBehaviorFieldsOnly migration to history';
END

IF NOT EXISTS (SELECT * FROM [__EFMigrationsHistory] WHERE [MigrationId] = '20250427070852_AddNewBehaviorFields')
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES ('20250427070852_AddNewBehaviorFields', '9.0.0');
    PRINT 'Added AddNewBehaviorFields migration to history';
END

IF NOT EXISTS (SELECT * FROM [__EFMigrationsHistory] WHERE [MigrationId] = '20250427081635_AddDocumentsTable')
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES ('20250427081635_AddDocumentsTable', '9.0.0');
    PRINT 'Added AddDocumentsTable migration to history';
END

IF NOT EXISTS (SELECT * FROM [__EFMigrationsHistory] WHERE [MigrationId] = '20250502161909_AddDocumentFileProperties')
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES ('20250502161909_AddDocumentFileProperties', '9.0.0');
    PRINT 'Added AddDocumentFileProperties migration to history';
END 