using Application.Configuration;
using Application.Data;
using Microsoft.Extensions.Options;

namespace Application.Business.Prices;

public class PriceService
{
    private readonly Dictionary<string, List<Unit>> units = new();
    private readonly Dictionary<string, long> sellers = new();
    private readonly List<LiveSale> liveSales = new();
    private readonly Dictionary<string, double> priceOverrides = new(StringComparer.OrdinalIgnoreCase);
    private readonly DonutApiOptions options;

    public PriceService(IOptions<DonutApiOptions> options)
    {
        this.options = options.Value;
    }

    public void LoadFromDatabase(IEnumerable<PriceRecord> priceRecords, IEnumerable<PriceOverride> overrides)
    {
        foreach (var r in priceRecords)
        {
            if (!units.TryGetValue(r.ItemName, out var list))
            {
                list = [];
                units[r.ItemName] = list;
            }
            if (list.Count >= 1000) list.RemoveAt(0);
            list.Add(new Unit { Price = r.Price, Amount = r.Amount, Timestamp = DateTimeOffset.FromUnixTimeMilliseconds(r.TimestampMs) });

            if (r.Seller.Length > 0)
            {
                if (!sellers.TryAdd(r.Seller, 1))
                    sellers[r.Seller]++;
            }
        }

        foreach (var o in overrides)
            priceOverrides[o.ItemName] = o.Price;
    }

    public void AddRecord(string unitName, double price, int amount, DateTimeOffset timestamp, string userId)
    {
        if (!sellers.TryAdd(userId, 1))
            sellers[userId]++;

        if (!units.TryGetValue(unitName, out var value))
        {
            value = [];
            units[unitName] = value;
        }

        if (value.Count >= 1000) value.RemoveAt(0);
        value.Add(new Unit { Price = price, Amount = amount, Timestamp = timestamp });

        liveSales.Insert(0, new LiveSale(unitName, userId, price, amount, timestamp));
        if (liveSales.Count > 20) liveSales.RemoveAt(20);
    }

    public bool RegisterItem(string itemName)
    {
        if (units.ContainsKey(itemName)) return false;
        units[itemName] = [];
        return true;
    }

    public void RemoveItem(string itemName)
    {
        units.Remove(itemName);
        priceOverrides.Remove(itemName);
        liveSales.RemoveAll(s => s.ItemName == itemName);
    }

    public void SetOverride(string itemName, double price) =>
        priceOverrides[itemName] = price;

    public void RemoveOverride(string itemName) =>
        priceOverrides.Remove(itemName);

    public IReadOnlyDictionary<string, double> GetAllOverrides() => priceOverrides;

    public double? GetOverridePrice(string itemName) =>
        priceOverrides.TryGetValue(itemName, out var price) ? price : null;

    public IReadOnlyList<LiveSale> GetLiveSales() => liveSales.AsReadOnly();

    public double GetAveragePrice(string unitName)
    {
        if (!units.TryGetValue(unitName, out var value) || value.Count == 0) return -1;
        return value.Average(p => p.Price);
    }

    public double GetMinPrice(string unitName)
    {
        if (!units.TryGetValue(unitName, out var value) || value.Count == 0) return -1;
        return value.Min(p => p.Price);
    }

    public double GetMaxPrice(string unitName)
    {
        if (!units.TryGetValue(unitName, out var value) || value.Count == 0) return -1;
        return value.Max(p => p.Price);
    }

    public double GetAmountRecorded(string unitName)
    {
        if (!units.TryGetValue(unitName, out var value) || value.Count == 0) return -1;
        return value.Sum(p => p.Amount);
    }

    public IReadOnlyList<SellerSummary> GetTopSellers(int count = 50)
    {
        var pinnedNames = new HashSet<string>(options.PinnedSellers, StringComparer.OrdinalIgnoreCase);

        var pinned = options.PinnedSellers
            .Where(sellers.ContainsKey)
            .Select(name => new SellerSummary(name, sellers[name]))
            .ToList();

        var rest = sellers
            .Where(kv => !pinnedNames.Contains(kv.Key))
            .OrderByDescending(kv => kv.Value)
            .Take(count - pinned.Count)
            .Select(kv => new SellerSummary(kv.Key, kv.Value));

        return pinned.Concat(rest).ToList();
    }

    public IReadOnlyList<PriceHistoryPoint> GetHistory(string unitName)
    {
        if (!units.TryGetValue(unitName, out var value)) return [];
        return value.Select(u => new PriceHistoryPoint(u.Timestamp, u.Price, u.Amount)).ToList();
    }

    public IReadOnlyList<PriceItemSummary> GetAllItems() =>
        units.Keys.Select(name => new PriceItemSummary(
            name,
            GetAveragePrice(name),
            GetMinPrice(name),
            GetMaxPrice(name),
            GetAmountRecorded(name),
            units[name].Count,
            GetOverridePrice(name)
        )).ToList();
}
