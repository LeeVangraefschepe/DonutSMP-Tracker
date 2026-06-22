namespace Application.Business.Prices;

public class Unit
{
    public double Price { get; internal set; }
    public int Amount { get; internal set; }
    public DateTimeOffset Timestamp { get; internal set; }
}

public record PriceItemSummary(string Name, double AveragePrice, double MinPrice, double MaxPrice, double AmountRecorded, int RecordCount, double? OverridePrice);
public record PriceHistoryPoint(DateTimeOffset Timestamp, double Price, int Amount);
public record SellerSummary(string Name, long SaleCount);
public record LiveSale(string ItemName, string Seller, double UnitPrice, int Amount, DateTimeOffset Timestamp);

public record RecipeIngredient(string Item, string Qty, bool? UseOverride = null);
public record RecipeOutput(string Item, string Qty, bool? UseOverride = null);
public record Recipe(string Id, string Name, string Category, RecipeOutput Output, RecipeIngredient[] Ingredients);
