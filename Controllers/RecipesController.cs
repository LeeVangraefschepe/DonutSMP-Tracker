using System.Text.Json;
using Application.Business.Prices;
using Application.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DonutSMP.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RecipesController : ControllerBase
{
    private readonly IDbContextFactory<DonutDbContext> dbFactory;

    public RecipesController(IDbContextFactory<DonutDbContext> dbFactory)
    {
        this.dbFactory = dbFactory;
    }

    [HttpGet]
    public async Task<IReadOnlyList<Recipe>> GetAll()
    {
        await using var db = await dbFactory.CreateDbContextAsync();
        var entities = await db.Recipes.ToListAsync();
        return entities.Select(MapToDto).ToList();
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] Recipe dto)
    {
        await using var db = await dbFactory.CreateDbContextAsync();
        db.Recipes.Add(MapToEntity(dto));
        await db.SaveChangesAsync();
        return Ok(dto);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, [FromBody] Recipe dto)
    {
        await using var db = await dbFactory.CreateDbContextAsync();
        var entity = await db.Recipes.FindAsync(id);
        if (entity == null) return NotFound();

        entity.Name = dto.Name;
        entity.Category = dto.Category;
        entity.OutputItem = dto.Output.Item;
        entity.OutputQty = dto.Output.Qty;
        entity.OutputUseOverride = dto.Output.UseOverride;
        entity.IngredientsJson = JsonSerializer.Serialize(dto.Ingredients);
        await db.SaveChangesAsync();

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        await using var db = await dbFactory.CreateDbContextAsync();
        var entity = await db.Recipes.FindAsync(id);
        if (entity == null) return NotFound();

        db.Recipes.Remove(entity);
        await db.SaveChangesAsync();
        return NoContent();
    }

    private static Recipe MapToDto(StoredRecipe entity)
    {
        var ingredients = JsonSerializer.Deserialize<RecipeIngredient[]>(entity.IngredientsJson) ?? [];
        return new Recipe(entity.Id, entity.Name, entity.Category, new RecipeOutput(entity.OutputItem, entity.OutputQty, entity.OutputUseOverride), ingredients);
    }

    private static StoredRecipe MapToEntity(Recipe dto) => new()
    {
        Id = dto.Id,
        Name = dto.Name,
        Category = dto.Category,
        OutputItem = dto.Output.Item,
        OutputQty = dto.Output.Qty,
        OutputUseOverride = dto.Output.UseOverride,
        IngredientsJson = JsonSerializer.Serialize(dto.Ingredients)
    };
}
