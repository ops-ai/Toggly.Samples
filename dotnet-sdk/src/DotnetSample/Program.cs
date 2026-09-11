using DotnetSample.Features;
using DotnetSample.Models;
using Hangfire;
using Hangfire.InMemory;
using Microsoft.Extensions.Http;
using Toggly.FeatureManagement;
using Toggly.FeatureManagement.Configuration;
using Toggly.FeatureManagement.HangfireExtensions;
using Toggly.FeatureManagement.HealthChecks;
using Toggly.FeatureManagement.NSwag.Configuration;
using Toggly.FeatureManagement.Web.Configuration;

var builder = WebApplication.CreateBuilder(args);
var key = builder.Configuration["TOGGLY_APP_KEY"];
var offline = string.IsNullOrWhiteSpace(key) || key == "ci-placeholder";
builder.Services.AddSingleton(new SampleMode(offline));
builder.Services.AddControllersWithViews();

// Register ONE shared definition cache. The targeting accessor reads each
// request; there is no initialization/setIdentity HTTP pair per user.
builder.Services.AddTogglyWeb(options =>
{
    options.AppKey = offline ? "" : key!;
    options.Environment = builder.Configuration["TOGGLY_ENVIRONMENT"] ?? "Production";
    options.UseSignedDefinitions = !offline;
    options.UndefinedEnabledOnDevelopment = false; // unknown flags stay OFF
    options.RegisterContextsOnStartup = !offline;
    if (offline)
    {
        // The SDK owns a WebSocket independent of HttpClient. Keep its offline
        // reconnect attempts on an unused loopback port, never a remote service.
        options.DefinitionsBaseUrl = "http://127.0.0.1:1/";
        options.BaseUrl = "http://127.0.0.1:1/";
    }
}).WithTogglyTargeting<RequestTargetingAccessor>();

builder.Services.AddTogglyEntityContext<Order>("Order", order => order.Id, schema => schema
    .KeyProperty("Id").Property("Vip", "boolean").Property("Total", "number")
    .MapAttributes(order => new Dictionary<string, object?> { ["Vip"] = order.Vip, ["Total"] = order.Total }));

if (offline)
{
    builder.Services.AddSingleton<OfflineDefinitions>();
    // ConfigureAll runs after the package's named client configuration and also
    // catches telemetry clients. No real credentials or internet are needed.
    builder.Services.ConfigureAll<HttpClientFactoryOptions>(options => options.HttpMessageHandlerBuilderActions.Add(handler =>
        handler.PrimaryHandler = new OfflineTransport(handler.Services.GetRequiredService<OfflineDefinitions>())));
}

builder.Services.AddHangfire(config => config.UseInMemoryStorage());
builder.Services.AddHangfireServer(options => options.WorkerCount = 1);
builder.Services.AddTransient<PracticeJob>();
builder.Services.AddHealthChecks().AddTogglyHealthCheck(configure: options =>
{
    options.RequiredFeatures = [FeatureFlags.Api];
    options.IncludeDiagnosticData = false; // don't expose SDK configuration in health output
});
builder.Services.AddOpenApiDocument((document, services) =>
{
    document.Title = ".NET feature flag sample";
    document.AddFeatureGateFiltering(services);
});

var app = builder.Build();
app.UseStaticFiles();
app.UseRouting();
app.Use(SamplePersonas.Apply);
// Generate after persona middleware, per request. UseOpenApi's cached output
// would not demonstrate changes to feature gates in a running application.
app.UseFeatureAwareOpenApi();
app.MapControllers();
app.MapControllerRoute("default", "{controller=Showcase}/{action=Index}/{id?}");
app.MapHealthChecks("/health/toggly");

// Job scheduling follows environment-level flag state (AlwaysOn), NOT an
// individual user's targeting. A request must never reschedule a global job.
app.Services.GetRequiredService<IFeatureStateService>().AddOrUpdateJob<PracticeJob>(
    app.Services, FeatureFlags.Submit, "enhanced-submit-practice", job => job.RunAsync(), Cron.Minutely());
app.Run();

// WebApplicationFactory starts this same app with real published integrations.
public partial class Program;
