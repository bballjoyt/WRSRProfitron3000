using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GameDataOCR.API.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Industries",
                columns: table => new
                {
                    Name = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    LastUpdated = table.Column<DateTime>(type: "TEXT", nullable: false, defaultValueSql: "datetime('now')")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Industries", x => x.Name);
                });

            migrationBuilder.CreateTable(
                name: "Resources",
                columns: table => new
                {
                    Name = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    NatoBuy = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    NatoSell = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    UssrBuy = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    UssrSell = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    LastUpdated = table.Column<DateTime>(type: "TEXT", nullable: false, defaultValueSql: "datetime('now')")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Resources", x => x.Name);
                });

            migrationBuilder.CreateTable(
                name: "Workdays",
                columns: table => new
                {
                    Name = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    NatoBuy = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    UssrBuy = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    NatoSell = table.Column<decimal>(type: "decimal(18,2)", nullable: false, defaultValue: 0m),
                    UssrSell = table.Column<decimal>(type: "decimal(18,2)", nullable: false, defaultValue: 0m),
                    LastUpdated = table.Column<DateTime>(type: "TEXT", nullable: false, defaultValueSql: "datetime('now')")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Workdays", x => x.Name);
                });

            migrationBuilder.CreateTable(
                name: "IndustrySections",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    SectionName = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    Items = table.Column<string>(type: "TEXT", nullable: false),
                    IndustryName = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IndustrySections", x => x.Id);
                    table.ForeignKey(
                        name: "FK_IndustrySections_Industries_IndustryName",
                        column: x => x.IndustryName,
                        principalTable: "Industries",
                        principalColumn: "Name",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_IndustrySections_IndustryName",
                table: "IndustrySections",
                column: "IndustryName");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "IndustrySections");

            migrationBuilder.DropTable(
                name: "Resources");

            migrationBuilder.DropTable(
                name: "Workdays");

            migrationBuilder.DropTable(
                name: "Industries");
        }
    }
}
