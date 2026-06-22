using System.Net.Http.Json;

namespace Application.API;

public class ActionHouse
{
    private readonly HttpClient httpClient;

    public ActionHouse(HttpClient httpClient)
    {
        this.httpClient = httpClient;
    }

    public async Task<Result[]> GetTransactionsAsync(int page = 1)
    {
        var response = await httpClient.GetFromJsonAsync<RootActionHouseObject>($"/v1/auction/transactions/{page}");
        return response?.result ?? Array.Empty<Result>();
    }
}