namespace Application.API;

public class RootActionHouseObject
{
    public int status { get; set; }
    public Result[] result { get; set; }
}

public class Result
{
    public Seller seller { get; set; }
    public double price { get; set; }
    public long unixMillisDateSold { get; set; }
    public Item item { get; set; }
}

public class Seller
{
    public string name { get; set; }
    public string uuid { get; set; }
}

public class Item
{
    public string id { get; set; }
    public int count { get; set; }
    public string display_name { get; set; }
    public object lore { get; set; }
    public Enchants enchants { get; set; }
    public Contents[] contents { get; set; }
}

public class Enchants
{
    public Enchantments enchantments { get; set; }
    public Trim trim { get; set; }
}

public class Enchantments
{
    public object levels { get; set; }
}

public class Trim
{
    public string material { get; set; }
    public string pattern { get; set; }
}

public class Contents
{
    public string id { get; set; }
    public int count { get; set; }
    public string display_name { get; set; }
    public Enchants1 enchants { get; set; }
}

public class Enchants1
{
    public Enchantments1 enchantments { get; set; }
    public Trim1 trim { get; set; }
}

public class Enchantments1
{
    public object levels { get; set; }
}

public class Trim1
{
    public string material { get; set; }
    public string pattern { get; set; }
}

