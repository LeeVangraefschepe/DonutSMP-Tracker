using Application.API;
using Application.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Application.Business.Prices;

public class PriceSystem : BackgroundService
{
    private readonly ActionHouse actionHouse;
    private readonly PriceService priceService;
    private readonly IDbContextFactory<DonutDbContext> dbFactory;
    private readonly ILogger<PriceSystem> logger;
    private readonly HashSet<string> processedIds = new();

    public PriceSystem(
        ActionHouse actionHouse,
        PriceService priceService,
        IDbContextFactory<DonutDbContext> dbFactory,
        ILogger<PriceSystem> logger)
    {
        this.actionHouse = actionHouse;
        this.priceService = priceService;
        this.dbFactory = dbFactory;
        this.logger = logger;
    }

    private static string TransactionId(Result transaction) =>
        $"{transaction.unixMillisDateSold}:{transaction.seller.uuid}:{transaction.item.id}";

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await InitializeDatabaseAsync(stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var transactions = await actionHouse.GetTransactionsAsync();
                var newPriceRecords = new List<PriceRecord>();
                var newProcessed = new List<ProcessedTransaction>();
                int newCount = 0;

                foreach (var transaction in transactions)
                {
                    var txId = TransactionId(transaction);
                    if (!processedIds.Add(txId)) continue;
                    newCount++;

                    var totalPrice = transaction.price;
                    var contents = transaction.item.contents;
                    string id;
                    bool sameItem = true;
                    int amount = 0;

                    if (contents is not { Length: > 0 })
                    {
                        id = transaction.item.id;
                        amount = transaction.item.count;
                    }
                    else
                    {
                        id = contents[0].id;
                        foreach (var content in contents)
                        {
                            if (content.id != id) { sameItem = false; break; }
                            amount += content.count;
                        }
                    }

                    if (sameItem && amount > 0)
                    {
                        var unitPrice = totalPrice / amount;
                        var timestamp = DateTimeOffset.FromUnixTimeMilliseconds(transaction.unixMillisDateSold);
                        priceService.AddRecord(id, unitPrice, amount, timestamp, transaction.seller.name);
                        newPriceRecords.Add(new PriceRecord
                        {
                            ItemName = id,
                            Seller = transaction.seller.name,
                            Price = unitPrice,
                            Amount = amount,
                            TimestampMs = transaction.unixMillisDateSold
                        });
                    }

                    newProcessed.Add(new ProcessedTransaction
                    {
                        TransactionId = txId,
                        TimestampMs = transaction.unixMillisDateSold
                    });
                }

                if (newCount > 0)
                {
                    await using var db = await dbFactory.CreateDbContextAsync(stoppingToken);
                    if (newPriceRecords.Count > 0)
                        db.PriceRecords.AddRange(newPriceRecords);
                    db.ProcessedTransactions.AddRange(newProcessed);
                    await db.SaveChangesAsync(stoppingToken);

                    logger.LogInformation("Processed {New} new transactions ({Total} seen so far)", newCount, processedIds.Count);
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to fetch transactions");
            }

            await Task.Delay(TimeSpan.FromMilliseconds(250), stoppingToken);
        }
    }

    private async Task InitializeDatabaseAsync(CancellationToken stoppingToken)
    {
        await using var db = await dbFactory.CreateDbContextAsync(stoppingToken);
        await db.Database.EnsureCreatedAsync(stoppingToken);

        // EnsureCreated only runs on an empty database; run these to add any tables
        // or columns that were introduced after the initial schema was created.
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "ManualItems" (
                "ItemName" TEXT NOT NULL CONSTRAINT "PK_ManualItems" PRIMARY KEY
            )
            """, stoppingToken);

        try { await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Recipes\" ADD COLUMN \"Category\" TEXT NOT NULL DEFAULT ''", stoppingToken); }
        catch { /* column already exists */ }

        try { await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Recipes\" ADD COLUMN \"OutputUseOverride\" INTEGER DEFAULT NULL", stoppingToken); }
        catch { /* column already exists */ }

        var cutoff = DateTimeOffset.UtcNow.AddDays(-7).ToUnixTimeMilliseconds();

        var priceRecords = await db.PriceRecords
            .Where(r => r.TimestampMs >= cutoff)
            .OrderBy(r => r.TimestampMs)
            .ToListAsync(stoppingToken);

        var overrides = await db.PriceOverrides.ToListAsync(stoppingToken);

        var txIds = await db.ProcessedTransactions
            .Where(t => t.TimestampMs >= cutoff)
            .Select(t => t.TransactionId)
            .ToListAsync(stoppingToken);

        var manualItems = await db.ManualItems.Select(m => m.ItemName).ToListAsync(stoppingToken);

        priceService.LoadFromDatabase(priceRecords, overrides);
        foreach (var itemName in manualItems)
            priceService.RegisterItem(itemName);
        foreach (var id in txIds)
            processedIds.Add(id);

        logger.LogInformation(
            "Loaded {Records} price records, {Overrides} price overrides, {Manual} manual items, {TxIds} processed transactions from database",
            priceRecords.Count, overrides.Count, manualItems.Count, txIds.Count);
    }
}
