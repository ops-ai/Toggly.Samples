using System.Net;
using System.Net.WebSockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using DotnetSample.Features;
using Hangfire;
using Hangfire.Storage;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Http;
using Microsoft.Extensions.Logging;
using Microsoft.FeatureManagement;
using Toggly.FeatureManagement;
using Toggly.FeatureManagement.Data;
using Xunit;

namespace DotnetSample.Tests;

public class SignedRefreshTests
{
    [Fact]
    public async Task Signed_updates_refresh_native_gates_OpenAPI_and_Hangfire_and_reject_tampering()
    {
        await using var feed = await SignedFeed.Start();
        await using var app = new SignedFactory(feed);
        using var client = app.CreateClient();
        await client.GetAsync("/");
        var provider = app.Services.GetRequiredService<IFeatureProviderDebug>();
        Assert.True(provider.GetDebugInfo().Loaded, provider.GetDebugInfo().LastError);
        await feed.Connected.Task.WaitAsync(TimeSpan.FromSeconds(15));
        await Until(() => Task.FromResult(provider.GetDebugInfo().Loaded));
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/beta")).StatusCode);
        Assert.Contains("enhanced-submit-practice", JobIds(app));

        // A real WebSocket notification makes the native SDK refetch. The local
        // feed signs a different payload, then corrupts its signature. Last-good
        // definitions must remain active: neither UI nor global jobs may flip.
        feed.Enabled = false;
        feed.Tamper = true;
        var prior = feed.Fetches;
        await feed.Notify();
        await Until(() => Task.FromResult(feed.Fetches > prior && provider.GetDebugInfo().LastError != null));
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/beta")).StatusCode);
        Assert.Contains("enhanced-submit-practice", JobIds(app));

        feed.Tamper = false;
        await feed.Notify();
        await Until(async () => (await client.GetAsync("/api/beta")).StatusCode == HttpStatusCode.NotFound);
        Assert.DoesNotContain("enhanced-submit-practice", JobIds(app));
        Assert.DoesNotContain("id=\"dashboard-on\"", await client.GetStringAsync("/gates"));
        using var offSchema = JsonDocument.Parse(await client.GetStringAsync("/swagger/v1/swagger.json"));
        Assert.False(offSchema.RootElement.GetProperty("paths").TryGetProperty("/api/beta", out _));

        feed.Enabled = true;
        await feed.Notify();
        await Until(async () => (await client.GetAsync("/api/beta")).StatusCode == HttpStatusCode.OK);
        Assert.Contains("enhanced-submit-practice", JobIds(app));
        Assert.Contains("id=\"dashboard-on\"", await client.GetStringAsync("/gates"));
        using var onSchema = JsonDocument.Parse(await client.GetStringAsync("/swagger/v1/swagger.json"));
        Assert.True(onSchema.RootElement.GetProperty("paths").TryGetProperty("/api/beta", out _));
    }

    [Fact]
    public async Task Invalid_first_signature_does_not_enable_unknown_definitions()
    {
        await using var feed = await SignedFeed.Start();
        feed.Tamper = true;
        await using var app = new SignedFactory(feed);
        using var client = app.CreateClient();
        var manager = app.Services.GetRequiredService<IFeatureManager>();
        Assert.False(await manager.IsEnabledAsync(FeatureFlags.Dashboard));
        Assert.False(app.Services.GetRequiredService<IFeatureProviderDebug>().GetDebugInfo().Loaded);
    }

    private static string[] JobIds(WebApplicationFactory<Program> app)
    {
        using var connection = app.Services.GetRequiredService<JobStorage>().GetConnection();
        return connection.GetRecurringJobs().Select(job => job.Id).ToArray();
    }

    private static async Task Until(Func<Task<bool>> condition)
    {
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(15));
        while (!await condition()) await Task.Delay(50, deadline.Token);
    }
}

internal sealed class SignedFactory(SignedFeed feed) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
            { ["TOGGLY_APP_KEY"] = "", ["TOGGLY_ENVIRONMENT"] = "Production" }));
        builder.ConfigureServices(services =>
        {
            // Host test configuration, not a package patch: native signed mode,
            // native verifier, native real loopback WebSocket, deterministic HTTP.
            services.Configure<TogglySettings>(options =>
            {
                options.UseSignedDefinitions = true;
                options.DefinitionsBaseUrl = feed.Address;
                options.RegisterContextsOnStartup = false;
            });
            services.ConfigureAll<HttpClientFactoryOptions>(options => options.HttpMessageHandlerBuilderActions.Add(handler =>
                handler.PrimaryHandler = new FeedTransport(feed)));
        });
    }
}

internal sealed class FeedTransport(SignedFeed feed) : HttpMessageHandler
{
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var path = request.RequestUri!.AbsolutePath;
        var json = path.Contains(".well-known/jwks") ? feed.Jwks : path.Contains("definitions-signed/") ? feed.Definitions() : null;
        return Task.FromResult(new HttpResponseMessage(json == null ? HttpStatusCode.NoContent : HttpStatusCode.OK)
            { Content = new StringContent(json ?? "", Encoding.UTF8, "application/json") });
    }
}

// The test owns this local fake SERVICE, while consuming unmodified NuGet SDK
// code. Ephemeral signing keys exist only in memory; none are Toggly credentials.
internal sealed class SignedFeed : IAsyncDisposable
{
    private readonly ECDsa signingKey = ECDsa.Create(ECCurve.NamedCurves.nistP256);
    private readonly CancellationTokenSource lifetime = new();
    private WebApplication? server;
    private WebSocket? socket;
    private int fetches;
    private long timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
    public bool Enabled { get; set; } = true;
    public bool Tamper { get; set; }
    public int Fetches => Volatile.Read(ref fetches);
    public string Address { get; private set; } = "";
    public TaskCompletionSource Connected { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private string KeyId
    {
        get
        {
            var key = signingKey.ExportParameters(false);
            // Toggly identifies ES256 keys by SHA-1(X || Y), uppercase hex + alg.
            // This is a key identifier, not the signature's security algorithm.
            return Convert.ToHexString(SHA1.HashData(key.Q.X!.Concat(key.Q.Y!).ToArray())) + "ES256";
        }
    }
    public string Jwks
    {
        get
        {
            var key = signingKey.ExportParameters(false);
            string Url(byte[] value) => Convert.ToBase64String(value).TrimEnd('=').Replace('+', '-').Replace('/', '_');
            return JsonSerializer.Serialize(new { keys = new[] { new { kty = "EC", crv = "P-256", alg = "ES256", use = "sig", kid = KeyId, x = Url(key.Q.X!), y = Url(key.Q.Y!) } } });
        }
    }
    public string Definitions()
    {
        Interlocked.Increment(ref fetches);
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Sample:DashboardEnabled"] = Enabled.ToString(), ["Sample:BetaEnabled"] = Enabled.ToString(),
            ["Sample:SubmitEnabled"] = Enabled.ToString()
        }).Build();
        var defs = JsonSerializer.Serialize(new OfflineDefinitions(config).Create());
        var stamp = Interlocked.Increment(ref timestamp);
        // The definitions service signs SHA-256(payload) with ECDSA/SHA-256,
        // which hashes that digest again. Match the public wire protocol exactly.
        var signature = signingKey.SignData(SHA256.HashData(Encoding.UTF8.GetBytes($"{defs}|{stamp}")), HashAlgorithmName.SHA256,
            DSASignatureFormat.IeeeP1363FixedFieldConcatenation);
        if (Tamper) signature[0] ^= 1;
        return $"{{\"defs\":{defs},\"timestamp\":{stamp},\"signature\":\"{Convert.ToBase64String(signature)}\",\"kid\":\"{KeyId}\"}}";
    }
    public static async Task<SignedFeed> Start()
    {
        var feed = new SignedFeed();
        var builder = WebApplication.CreateBuilder();
        builder.Logging.ClearProviders();
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        feed.server = builder.Build();
        feed.server.UseWebSockets();
        feed.server.Run(async context =>
        {
            if (!context.WebSockets.IsWebSocketRequest) { context.Response.StatusCode = 404; return; }
            using var socket = await context.WebSockets.AcceptWebSocketAsync();
            feed.socket = socket;
            feed.Connected.TrySetResult();
            try
            {
                var buffer = new byte[1024];
                while (!feed.lifetime.IsCancellationRequested && socket.State == WebSocketState.Open)
                    await socket.ReceiveAsync(buffer, feed.lifetime.Token);
            }
            catch (OperationCanceledException) { }
            catch (WebSocketException) { }
        });
        await feed.server.StartAsync();
        feed.Address = feed.server.Urls.Single() + "/";
        return feed;
    }
    public Task Notify() => socket!.SendAsync(Encoding.UTF8.GetBytes("update"), WebSocketMessageType.Text, true, lifetime.Token);
    public async ValueTask DisposeAsync()
    {
        await lifetime.CancelAsync();
        socket?.Abort();
        if (server != null) await server.DisposeAsync();
        lifetime.Dispose();
        signingKey.Dispose();
    }
}
