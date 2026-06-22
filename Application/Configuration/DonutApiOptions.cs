namespace Application.Configuration;

public class DonutApiOptions
{
    public string ApiKey { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = string.Empty;
    public int TransactionCount { get; set; }
    public string[] PinnedSellers { get; set; } = [];
}
