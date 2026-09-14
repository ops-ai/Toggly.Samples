using BlazorSample.Client;
using BlazorSample.Components;
using BlazorSample.Features;
using Microsoft.Extensions.Http;
using Toggly.FeatureManagement.Blazor.Server;
using Toggly.FeatureManagement.Configuration;

var builder = WebApplication.CreateBuilder(args);
builder
    .Services.AddRazorComponents()
    .AddInteractiveServerComponents()
    .AddInteractiveWebAssemblyComponents();
var backendKey = builder.Configuration["TOGGLY_APP_KEY"];
var settings = new PublicSettings(
    builder.Configuration["TOGGLY_FRONTEND_APP_KEY"],
    builder.Configuration["TOGGLY_ENVIRONMENT"] ?? "Production",
    !string.IsNullOrWhiteSpace(backendKey)
);
builder.Services.AddSingleton(settings);

// The trusted backend key remains in this server process. Only the explicit
// Front-end App Key and environment are returned by the public settings endpoint.
builder.Services.AddToggly(options =>
{
    options.AppKey = backendKey ?? "";
    options.Environment = settings.Environment;
    options.UseSignedDefinitions = !string.IsNullOrWhiteSpace(backendKey);
    options.UndefinedEnabledOnDevelopment = false;
    options.RegisterContextsOnStartup = false;
    if (string.IsNullOrWhiteSpace(backendKey))
    {
        options.DefinitionsBaseUrl = "http://127.0.0.1:1/";
        options.BaseUrl = "http://127.0.0.1:1/";
    }
});
builder.Services.AddTogglyBlazorServer();
if (string.IsNullOrWhiteSpace(backendKey))
{
    // Offline transport feeds schema fixtures to the real trusted SDK parser and
    // filters, and blocks telemetry HTTP. It never substitutes a fake app key.
    builder.Services.ConfigureAll<HttpClientFactoryOptions>(options =>
        options.HttpMessageHandlerBuilderActions.Add(handler =>
            handler.PrimaryHandler = new OfflineTransport()
        )
    );
}
var app = builder.Build();
app.UseStaticFiles();
app.UseAntiforgery();
#if NET9_0_OR_GREATER
app.MapStaticAssets();
#endif
app.MapGet("/public-toggly.json", () => settings);
app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode()
    .AddInteractiveWebAssemblyRenderMode()
    .AddAdditionalAssemblies(typeof(PublicSettings).Assembly);
app.Run();
