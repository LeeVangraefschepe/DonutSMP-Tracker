using Microsoft.EntityFrameworkCore;

namespace Application.Data;

public class DonutDbContext : DbContext
{
    public DbSet<PriceRecord> PriceRecords => Set<PriceRecord>();
    public DbSet<PriceOverride> PriceOverrides => Set<PriceOverride>();
    public DbSet<StoredRecipe> Recipes => Set<StoredRecipe>();
    public DbSet<ProcessedTransaction> ProcessedTransactions => Set<ProcessedTransaction>();
    public DbSet<ManualItem> ManualItems => Set<ManualItem>();

    public DonutDbContext(DbContextOptions<DonutDbContext> options) : base(options) { }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<PriceOverride>().HasKey(p => p.ItemName);
        modelBuilder.Entity<StoredRecipe>().HasKey(r => r.Id);
        modelBuilder.Entity<ProcessedTransaction>().HasKey(t => t.TransactionId);
        modelBuilder.Entity<ManualItem>().HasKey(m => m.ItemName);
    }
}
