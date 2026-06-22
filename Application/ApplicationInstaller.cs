using Application.API;
using Application.Business.Prices;
using Application.Configuration;
using Application.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Application;

public static class ApplicationInstaller
{
    public static IServiceCollection AddDonutApplication(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<DonutApiOptions>(configuration.GetSection("DonutApi"));

        services.AddDbContextFactory<DonutDbContext>(options => options.UseSqlite(configuration.GetConnectionString("DefaultConnection")));

        services.AddHttpClient<ActionHouse>((sp, client) =>
        {
            var options = sp.GetRequiredService<IOptions<DonutApiOptions>>().Value;
            client.BaseAddress = new Uri(options.BaseUrl);
            client.DefaultRequestHeaders.Add("Authorization", options.ApiKey);
        });

        services.AddSingleton<PriceService>();
        services.AddHostedService<PriceSystem>();

        return services;
    }
}
