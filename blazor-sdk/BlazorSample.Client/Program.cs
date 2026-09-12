using BlazorSample.Client;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using System.Net.Http.Json;
using Toggly.FeatureManagement.Blazor;
using Toggly.FeatureManagement.Client;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
var http = new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) };
var settings = await http.GetFromJsonAsync<PublicSettings>("public-toggly.json") ?? new(null,"Production");
builder.Services.AddSingleton(http);
builder.Services.AddSingleton(settings);
// Browser code receives only a Front-end App Key. Defaults are deliberate demo
// choices: baseline gates ON; every restrictive or entity flag defaults OFF.
builder.Services.AddTogglyBlazorWebAssembly(_ => new TogglyClientOptions {
    AppKey = settings.FrontendAppKey, Environment = settings.Environment,
    Defaults = new Dictionary<string,bool> { ["new-dashboard"] = true, ["api-v2"] = true, ["enhanced-submit"] = true, ["beta-access"] = true, ["filter-always-on"] = true }
});
await builder.Build().RunAsync();
