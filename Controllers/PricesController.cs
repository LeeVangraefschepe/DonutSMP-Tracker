using Application.Business.Prices;
using Application.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DonutSMP.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PricesController : ControllerBase
{
    private readonly PriceService priceService;
    private readonly IDbContextFactory<DonutDbContext> dbFactory;

    public PricesController(PriceService priceService, IDbContextFactory<DonutDbContext> dbFactory)
    {
        this.priceService = priceService;
        this.dbFactory = dbFactory;
    }

    [HttpGet]
    public IReadOnlyList<PriceItemSummary> Get() => priceService.GetAllItems();

    [HttpGet("{name}/history")]
    public IReadOnlyList<PriceHistoryPoint> GetHistory(string name) => priceService.GetHistory(name);

    [HttpGet("sellers")]
    public IReadOnlyList<SellerSummary> GetSellers() => priceService.GetTopSellers();

    [HttpGet("live")]
    public IReadOnlyList<LiveSale> GetLive() => priceService.GetLiveSales();

    [HttpPost("items")]
    public async Task<IActionResult> AddManualItem([FromBody] string itemName)
    {
        if (string.IsNullOrWhiteSpace(itemName)) return BadRequest();
        itemName = itemName.Trim();

        priceService.RegisterItem(itemName);

        await using var db = await dbFactory.CreateDbContextAsync();
        if (!await db.ManualItems.AnyAsync(m => m.ItemName == itemName))
        {
            db.ManualItems.Add(new ManualItem { ItemName = itemName });
            await db.SaveChangesAsync();
        }

        return Ok();
    }

    [HttpDelete("items/{itemName}")]
    public async Task<IActionResult> RemoveItem(string itemName)
    {
        priceService.RemoveItem(itemName);

        await using var db = await dbFactory.CreateDbContextAsync();
        await db.PriceRecords.Where(r => r.ItemName == itemName).ExecuteDeleteAsync();
        await db.ManualItems.Where(m => m.ItemName == itemName).ExecuteDeleteAsync();
        await db.PriceOverrides.Where(p => p.ItemName == itemName).ExecuteDeleteAsync();

        return NoContent();
    }

    [HttpPut("overrides/{itemName}")]
    public async Task<IActionResult> SetOverride(string itemName, [FromBody] double price)
    {
        priceService.SetOverride(itemName, price);

        await using var db = await dbFactory.CreateDbContextAsync();
        var existing = await db.PriceOverrides.FindAsync(itemName);
        if (existing != null)
            existing.Price = price;
        else
            db.PriceOverrides.Add(new PriceOverride { ItemName = itemName, Price = price });

        db.PriceOverrideHistories.Add(new PriceOverrideHistory
        {
            ItemName = itemName,
            Price = price,
            TimestampMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        });
        await db.SaveChangesAsync();

        return NoContent();
    }

    [HttpDelete("overrides/{itemName}")]
    public async Task<IActionResult> RemoveOverride(string itemName)
    {
        priceService.RemoveOverride(itemName);

        await using var db = await dbFactory.CreateDbContextAsync();
        var entity = await db.PriceOverrides.FindAsync(itemName);
        if (entity != null)
        {
            db.PriceOverrides.Remove(entity);
            db.PriceOverrideHistories.Add(new PriceOverrideHistory
            {
                ItemName = itemName,
                Price = null,
                TimestampMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            });
            await db.SaveChangesAsync();
        }

        return NoContent();
    }

    [HttpGet("overrides/{itemName}/history")]
    public async Task<IReadOnlyList<OverrideHistoryPoint>> GetOverrideHistory(string itemName)
    {
        await using var db = await dbFactory.CreateDbContextAsync();
        return await db.PriceOverrideHistories
            .Where(h => h.ItemName == itemName)
            .OrderByDescending(h => h.TimestampMs)
            .Select(h => new OverrideHistoryPoint(
                h.Id,
                h.Price,
                DateTimeOffset.FromUnixTimeMilliseconds(h.TimestampMs)))
            .ToListAsync();
    }

    [HttpDelete("overrides/history/{id:int}")]
    public async Task<IActionResult> DeleteOverrideHistoryEntry(int id)
    {
        await using var db = await dbFactory.CreateDbContextAsync();
        var entry = await db.PriceOverrideHistories.FindAsync(id);
        if (entry == null) return NotFound();
        db.PriceOverrideHistories.Remove(entry);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
