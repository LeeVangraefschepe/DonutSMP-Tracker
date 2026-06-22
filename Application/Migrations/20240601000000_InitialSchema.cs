using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Application.Migrations;

public partial class InitialSchema : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "FuelItems",
            columns: table => new
            {
                ItemName   = table.Column<string>(type: "TEXT", nullable: false),
                SmeltCount = table.Column<double>(type: "REAL",    nullable: false)
            },
            constraints: table => table.PrimaryKey("PK_FuelItems", x => x.ItemName));

        migrationBuilder.CreateTable(
            name: "ManualItems",
            columns: table => new
            {
                ItemName = table.Column<string>(type: "TEXT", nullable: false)
            },
            constraints: table => table.PrimaryKey("PK_ManualItems", x => x.ItemName));

        migrationBuilder.CreateTable(
            name: "PriceOverrideHistories",
            columns: table => new
            {
                Id          = table.Column<int>(type: "INTEGER", nullable: false).Annotation("Sqlite:Autoincrement", true),
                ItemName    = table.Column<string>(type: "TEXT",    nullable: false),
                Price       = table.Column<double>(type: "REAL",    nullable: true),
                TimestampMs = table.Column<long>(type: "INTEGER",   nullable: false)
            },
            constraints: table => table.PrimaryKey("PK_PriceOverrideHistories", x => x.Id));

        migrationBuilder.CreateTable(
            name: "PriceOverrides",
            columns: table => new
            {
                ItemName = table.Column<string>(type: "TEXT", nullable: false),
                Price    = table.Column<double>(type: "REAL", nullable: false)
            },
            constraints: table => table.PrimaryKey("PK_PriceOverrides", x => x.ItemName));

        migrationBuilder.CreateTable(
            name: "PriceRecords",
            columns: table => new
            {
                Id          = table.Column<int>(type: "INTEGER", nullable: false).Annotation("Sqlite:Autoincrement", true),
                ItemName    = table.Column<string>(type: "TEXT",    nullable: false),
                Seller      = table.Column<string>(type: "TEXT",    nullable: false),
                Price       = table.Column<double>(type: "REAL",    nullable: false),
                Amount      = table.Column<int>(type: "INTEGER",    nullable: false),
                TimestampMs = table.Column<long>(type: "INTEGER",   nullable: false)
            },
            constraints: table => table.PrimaryKey("PK_PriceRecords", x => x.Id));

        migrationBuilder.CreateTable(
            name: "ProcessedTransactions",
            columns: table => new
            {
                TransactionId = table.Column<string>(type: "TEXT",    nullable: false),
                TimestampMs   = table.Column<long>(type: "INTEGER",   nullable: false)
            },
            constraints: table => table.PrimaryKey("PK_ProcessedTransactions", x => x.TransactionId));

        migrationBuilder.CreateTable(
            name: "Recipes",
            columns: table => new
            {
                Id               = table.Column<string>(type: "TEXT",    nullable: false),
                Name             = table.Column<string>(type: "TEXT",    nullable: false),
                Category         = table.Column<string>(type: "TEXT",    nullable: false, defaultValue: ""),
                OutputItem       = table.Column<string>(type: "TEXT",    nullable: false),
                OutputQty        = table.Column<string>(type: "TEXT",    nullable: false, defaultValue: "1"),
                OutputUseOverride = table.Column<bool>(type: "INTEGER",  nullable: true),
                IngredientsJson  = table.Column<string>(type: "TEXT",    nullable: false, defaultValue: "[]")
            },
            constraints: table => table.PrimaryKey("PK_Recipes", x => x.Id));
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "FuelItems");
        migrationBuilder.DropTable(name: "ManualItems");
        migrationBuilder.DropTable(name: "PriceOverrideHistories");
        migrationBuilder.DropTable(name: "PriceOverrides");
        migrationBuilder.DropTable(name: "PriceRecords");
        migrationBuilder.DropTable(name: "ProcessedTransactions");
        migrationBuilder.DropTable(name: "Recipes");
    }
}
