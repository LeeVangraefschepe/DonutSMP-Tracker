using Application.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DonutSMP.Controllers;

[ApiController]
[Route("api/[controller]")]
public class FuelController : ControllerBase
{
    private readonly IDbContextFactory<DonutDbContext> dbFactory;

    public FuelController(IDbContextFactory<DonutDbContext> dbFactory)
    {
        this.dbFactory = dbFactory;
    }

    [HttpGet]
    public async Task<IReadOnlyList<FuelItem>> GetAll()
    {
        await using var db = await dbFactory.CreateDbContextAsync();
        return await db.FuelItems.OrderBy(f => f.ItemName).ToListAsync();
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] FuelItem item)
    {
        if (string.IsNullOrWhiteSpace(item.ItemName) || item.SmeltCount <= 0) return BadRequest();

        await using var db = await dbFactory.CreateDbContextAsync();
        if (await db.FuelItems.AnyAsync(f => f.ItemName == item.ItemName)) return Conflict();
        db.FuelItems.Add(item);
        await db.SaveChangesAsync();
        return Ok(item);
    }

    [HttpPut("{itemName}")]
    public async Task<IActionResult> Update(string itemName, [FromBody] double smeltCount)
    {
        if (smeltCount <= 0) return BadRequest();

        await using var db = await dbFactory.CreateDbContextAsync();
        var entity = await db.FuelItems.FindAsync(itemName);
        if (entity == null) return NotFound();
        entity.SmeltCount = smeltCount;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{itemName}")]
    public async Task<IActionResult> Delete(string itemName)
    {
        await using var db = await dbFactory.CreateDbContextAsync();
        var entity = await db.FuelItems.FindAsync(itemName);
        if (entity == null) return NotFound();
        db.FuelItems.Remove(entity);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
