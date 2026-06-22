using Application;
using Microsoft.Extensions.Hosting;

var host = Host.CreateDefaultBuilder(args)
    .ConfigureServices((context, services) =>
    {
        services.AddDonutApplication(context.Configuration);
    })
    .Build();

await host.RunAsync();
