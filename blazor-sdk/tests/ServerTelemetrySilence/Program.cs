using Microsoft.Extensions.DependencyInjection;
using Microsoft.JSInterop;
using Toggly.FeatureManagement.Blazor;
using Toggly.FeatureManagement.Blazor.Server;
using Toggly.FeatureManagement.Client;

if (typeof(IFrontendTelemetry).IsAssignableFrom(typeof(ServerFeatureSession)))
    throw new InvalidOperationException("Blazor Server unexpectedly owns frontend telemetry.");

var js = new NoJs();
var services = new ServiceCollection();
services.AddSingleton<IJSRuntime>(js);
services.AddSingleton(new HttpClient(new NoNetwork()));
services.AddTogglyBlazorWebAssembly(_ => new()
{
    AppKey = "sample-server-key",
    Environment = "Fixture",
    MetricsBaseUrl = "http://127.0.0.1:1",
    EnableLiveUpdates = false,
    Defaults = new Dictionary<string, bool> { ["on"] = true },
});
await using var provider = services.BuildServiceProvider();
await using var scope = provider.CreateAsyncScope();
var session = scope.ServiceProvider.GetRequiredService<IFeatureSession>();
if (!await session.EvaluateAsync(["on"]))
    throw new InvalidOperationException("Prerender fallback did not evaluate.");
var events = (IFrontendTelemetry)session;
events.RecordUsage("on");
events.RecordView("on");
events.IncrementCounter("orders", 2);
events.SetGauge("cart", 3.5);
await events.FlushTelemetryAsync();
await session.DisposeAsync();
if (js.Calls != 0)
    throw new InvalidOperationException("A non-browser runtime invoked JS transport.");
Console.WriteLine("public 3.10.0 non-browser registration: evaluation true; zero JS transport calls; Server session has no frontend reporter");

sealed class NoJs : IJSRuntime
{
    public int Calls { get; private set; }
    public ValueTask<TValue> InvokeAsync<TValue>(string identifier, object?[]? args)
    {
        Calls++;
        throw new InvalidOperationException("JS called from non-browser host");
    }
    public ValueTask<TValue> InvokeAsync<TValue>(string identifier, CancellationToken cancellationToken, object?[]? args)
        => InvokeAsync<TValue>(identifier, args);
}

sealed class NoNetwork : HttpMessageHandler
{
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        => throw new InvalidOperationException("Unexpected network request from non-browser host");
}
