namespace Application.Data;

public class PriceRecord
{
    public int Id { get; set; }
    public string ItemName { get; set; } = "";
    public string Seller { get; set; } = "";
    public double Price { get; set; }
    public int Amount { get; set; }
    public long TimestampMs { get; set; }
}

public class PriceOverride
{
    public string ItemName { get; set; } = "";
    public double Price { get; set; }
}

public class StoredRecipe
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Category { get; set; } = "";
    public string OutputItem { get; set; } = "";
    public string OutputQty { get; set; } = "1";
    public bool? OutputUseOverride { get; set; }
    public string IngredientsJson { get; set; } = "[]";
}

public class ProcessedTransaction
{
    public string TransactionId { get; set; } = "";
    public long TimestampMs { get; set; }
}

public class ManualItem
{
    public string ItemName { get; set; } = "";
}
