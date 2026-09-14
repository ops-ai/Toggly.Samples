using BlazorSample.Client;
using BlazorSample.Components;
using BlazorSample.Features;
using Microsoft.Extensions.Http;
using Toggly.FeatureManagement;
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
var snapshotDirectory = builder.Configuration["TOGGLY_SNAPSHOT_DIRECTORY"];
var networkMode = builder.Configuration["TOGGLY_NETWORK_MODE"] ?? "online";
if (networkMode is not ("online" or "offline"))
    throw new InvalidOperationException("TOGGLY_NETWORK_MODE must be online or offline.");
var denyNetwork = networkMode == "offline";
if (denyNetwork &&
    (string.IsNullOrWhiteSpace(backendKey) || string.IsNullOrWhiteSpace(snapshotDirectory)))
    throw new InvalidOperationException("Offline mode requires a backend key and snapshot directory.");
if (!string.IsNullOrWhiteSpace(snapshotDirectory))
{
    if (!Path.IsPathFullyQualified(snapshotDirectory) || string.IsNullOrWhiteSpace(backendKey))
        throw new InvalidOperationException("Snapshot storage requires an absolute directory and backend key.");
    var fullDirectory = Path.GetFullPath(snapshotDirectory);
    var contentRoot = Path.GetFullPath(builder.Environment.ContentRootPath) + Path.DirectorySeparatorChar;
    if (fullDirectory.StartsWith(contentRoot, StringComparison.OrdinalIgnoreCase) ||
        fullDirectory == contentRoot.TrimEnd(Path.DirectorySeparatorChar))
        throw new InvalidOperationException("Snapshot storage must be outside the application content root.");
    builder.Services.AddSingleton<IFeatureSnapshotProvider>(services =>
        new FileFeatureSnapshotProvider(
            snapshotDirectory,
            backendKey ?? "",
            settings.Environment,
            services.GetRequiredService<ILogger<FileFeatureSnapshotProvider>>()
        )
    );
}
var definitionsUrl = builder.Configuration["TOGGLY_DEFINITIONS_URL"];
if (string.IsNullOrWhiteSpace(definitionsUrl))
    definitionsUrl = null;
if (!string.IsNullOrWhiteSpace(definitionsUrl) &&
    (!Uri.TryCreate(definitionsUrl, UriKind.Absolute, out var uri) ||
     (uri.Scheme != "https" && !(uri.Scheme == "http" && uri.IsLoopback)) ||
     !string.IsNullOrEmpty(uri.UserInfo) ||
     !string.IsNullOrEmpty(uri.Query) ||
     !string.IsNullOrEmpty(uri.Fragment)))
    throw new InvalidOperationException("Definitions URL must be trusted HTTPS or loopback HTTP without credentials, query or fragment.");

// The trusted backend key remains in this server process. Only the explicit
// Front-end App Key and environment are returned by the public settings endpoint.
builder.Services.AddToggly(options =>
{
    options.AppKey = backendKey ?? "";
    options.Environment = settings.Environment;
    options.UseSignedDefinitions = !string.IsNullOrWhiteSpace(backendKey);
    options.UndefinedEnabledOnDevelopment = false;
    options.RegisterContextsOnStartup = false;
    options.DefinitionsBaseUrl = definitionsUrl;
    if (string.IsNullOrWhiteSpace(backendKey) || denyNetwork)
    {
        options.DefinitionsBaseUrl = "http://127.0.0.1:1/";
        options.BaseUrl = "http://127.0.0.1:1/";
    }
});
builder.Services.AddTogglyBlazorServer();
if (denyNetwork)
{
    // SDK HTTP/gRPC is denied. Its direct WebSocket bypasses this factory, so
    // DefinitionsBaseUrl above confines that attempted connection to closed loopback.
    builder.Services.ConfigureAll<HttpClientFactoryOptions>(options =>
        options.HttpMessageHandlerBuilderActions.Add(handler =>
        {
            // Retrying an intentionally denied request would only delay startup.
            handler.AdditionalHandlers.Clear();
            handler.PrimaryHandler = new DenyTogglyTransport();
        }));
}
else if (string.IsNullOrWhiteSpace(backendKey))
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
