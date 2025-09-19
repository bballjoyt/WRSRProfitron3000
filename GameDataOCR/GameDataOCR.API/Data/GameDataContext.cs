using Microsoft.EntityFrameworkCore;
using GameDataOCR.API.Data.Entities;

namespace GameDataOCR.API.Data;

public class GameDataContext : DbContext
{
    public GameDataContext(DbContextOptions<GameDataContext> options) : base(options)
    {
    }

    public DbSet<Resource> Resources { get; set; }
    public DbSet<Industry> Industries { get; set; }
    public DbSet<IndustrySectionEntity> IndustrySections { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Resource configuration
        modelBuilder.Entity<Resource>(entity =>
        {
            entity.HasKey(e => e.Name);
            entity.Property(e => e.Name).HasMaxLength(100);
            entity.Property(e => e.NatoBuy).HasColumnType("decimal(18,2)");
            entity.Property(e => e.NatoSell).HasColumnType("decimal(18,2)");
            entity.Property(e => e.UssrBuy).HasColumnType("decimal(18,2)");
            entity.Property(e => e.UssrSell).HasColumnType("decimal(18,2)");
            entity.Property(e => e.LastUpdated).HasDefaultValueSql("datetime('now')");
        });

        // Industry configuration
        modelBuilder.Entity<Industry>(entity =>
        {
            entity.HasKey(e => e.Name);
            entity.Property(e => e.Name).HasMaxLength(100);
            entity.Property(e => e.LastUpdated).HasDefaultValueSql("datetime('now')");

            entity.HasMany(e => e.Sections)
                  .WithOne(e => e.Industry)
                  .HasForeignKey(e => e.IndustryName)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // Industry Section configuration
        modelBuilder.Entity<IndustrySectionEntity>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.SectionName).HasMaxLength(200);
            entity.Property(e => e.Items).HasConversion(
                v => string.Join(';', v),
                v => v.Split(';', StringSplitOptions.RemoveEmptyEntries).ToList()
            );
        });

        base.OnModelCreating(modelBuilder);
    }
}