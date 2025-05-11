using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ChattyWidget.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddBehaviorFieldsOnly : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "CollectUserFeedback",
                table: "WidgetSettings",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsOfflineMode",
                table: "WidgetSettings",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "OfflineMessage",
                table: "WidgetSettings",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "RequireEmailToStart",
                table: "WidgetSettings",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "ShowSources",
                table: "WidgetSettings",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AlterColumn<string>(
                name: "Role",
                table: "Users",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(50)",
                oldMaxLength: 50,
                oldDefaultValue: "user");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CollectUserFeedback",
                table: "WidgetSettings");

            migrationBuilder.DropColumn(
                name: "IsOfflineMode",
                table: "WidgetSettings");

            migrationBuilder.DropColumn(
                name: "OfflineMessage",
                table: "WidgetSettings");

            migrationBuilder.DropColumn(
                name: "RequireEmailToStart",
                table: "WidgetSettings");

            migrationBuilder.DropColumn(
                name: "ShowSources",
                table: "WidgetSettings");

            migrationBuilder.AlterColumn<string>(
                name: "Role",
                table: "Users",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "user",
                oldClrType: typeof(string),
                oldType: "nvarchar(50)",
                oldMaxLength: 50);
        }
    }
}
