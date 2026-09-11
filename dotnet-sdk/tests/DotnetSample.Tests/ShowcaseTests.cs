using System.Net;
using System.Text.Json;
using DotnetSample.Features;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.FeatureManagement;
using Toggly.FeatureManagement;
using Xunit;

namespace DotnetSample.Tests;

// All requests run the actual MVC/Razor application and published Toggly packages.
// Tests substitute transport data, never IFeatureManager or the feature helper.
public sealed class SampleFactory(Dictionary<string, string?>? settings = null) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder) => builder.ConfigureAppConfiguration((_, config) =>
        config.AddInMemoryCollection(new Dictionary<string, string?> { ["TOGGLY_APP_KEY"] = "", ["TOGGLY_ENVIRONMENT"] = "Production" }
            .Concat(settings ?? [])));
}

public class ShowcaseTests
{
    [Fact]
    public async Task Missing_key_starts_and_teaches_offline_mode()
    {
        await using var app = new SampleFactory();
        using var client = app.CreateClient();
        foreach (var path in new[] { "/", "/gates", "/programmatic", "/identity", "/orders", "/filters", "/integrations" })
        {
            var response = await client.GetAsync(path);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Contains("Offline practice", await response.Content.ReadAsStringAsync());
        }
        Assert.IsType<TogglyFeatureProvider>(app.Services.GetRequiredService<IFeatureDefinitionProvider>());
        Assert.IsType<TogglyFeatureManager>(app.Services.GetRequiredService<IFeatureManager>());
    }

    [Fact]
    public async Task Razor_gates_and_named_variants_use_native_published_apis()
    {
        await using var app = new SampleFactory();
        using var client = app.CreateClient();
        var alice = await client.GetStringAsync("/gates?preset=matching");
        Assert.Contains("id=\"dashboard-on\"", alice);
        Assert.DoesNotContain("id=\"dashboard-off\"", alice);
        Assert.Contains("id=\"all-gate\"", alice);
        Assert.Contains("id=\"any-gate\"", alice);
        Assert.Contains("id=\"variant-preview\"", alice);
        Assert.Contains("id=\"entity-gate\"", alice);
        Assert.Contains("id=\"variant-classic\"", await client.GetStringAsync("/gates?preset=nonmatching"));

        await using var disabled = new SampleFactory(new() { ["Sample:DashboardEnabled"] = "false" });
        using var offClient = disabled.CreateClient();
        var off = await offClient.GetStringAsync("/gates");
        Assert.DoesNotContain("id=\"dashboard-on\"", off);
        Assert.Contains("id=\"dashboard-off\"", off);
        Assert.DoesNotContain("id=\"all-gate\"", off);
        Assert.Contains("id=\"any-gate\"", off);
        Assert.Equal(HttpStatusCode.NotFound, (await offClient.GetAsync("/api/multi")).StatusCode);
    }

    [Fact]
    public async Task Matrix_presets_and_entity_fail_closed_are_actual_evaluations()
    {
        await using var app = new SampleFactory();
        using var client = app.CreateClient();
        foreach (var preset in new[] { "matching", "nonmatching" })
        {
            using var snapshot = JsonDocument.Parse(await client.GetStringAsync("/api/snapshot?preset=" + preset));
            var data = snapshot.RootElement;
            var flags = data.GetProperty("flags");
            Assert.False(data.GetProperty("noEntity").GetBoolean());
            Assert.False(data.GetProperty("unknownEntity").GetBoolean());
            Assert.Equal(preset == "matching", flags.GetProperty("ExpressCheckout").GetBoolean());
            foreach (var key in FeatureFlags.Filters.Where(key => key != "filter-percentage" && key != "filter-device-type"))
                Assert.True((key is "filter-always-on" or "filter-time-window" || preset == "matching") == flags.GetProperty(key).GetBoolean(), $"{preset}: {key} = {flags.GetProperty(key)}; parsed device={UAParser.Parser.GetDefault().Parse(preset == "matching" ? SamplePersonas.Matching.Agent : SamplePersonas.NonMatching.Agent).Device.Family}");
            // UAParser's native .NET device family is Mac, not the catalog's
            // Macintosh. Keep the actual shared rule and expose the mismatch.
            Assert.Equal("Mac", UAParser.Parser.GetDefault().Parse(SamplePersonas.Matching.Agent).Device.Family);
            Assert.False(flags.GetProperty("filter-device-type").GetBoolean());
            using var again = JsonDocument.Parse(await client.GetStringAsync("/api/snapshot?preset=" + preset));
            Assert.Equal(flags.GetProperty("filter-percentage").GetBoolean(), again.RootElement.GetProperty("flags").GetProperty("filter-percentage").GetBoolean());
        }
        var manager = app.Services.GetRequiredService<IFeatureManager>();
        Assert.False(await manager.IsEnabledAsync("undefined-flag"));
    }

    [Fact]
    public async Task Concurrent_personas_do_not_change_another_requests_identity_or_order()
    {
        await using var app = new SampleFactory();
        using var client = app.CreateClient();
        // Warm the shared definitions once; every subsequent targeting decision
        // must still be request-local, including overlapping async operations.
        await client.GetAsync("/");
        await Task.WhenAll(Enumerable.Range(0, 32).Select(async index =>
        {
            var matching = index % 2 == 0;
            using var result = JsonDocument.Parse(await client.GetStringAsync("/api/snapshot?preset=" + (matching ? "matching" : "nonmatching")));
            var data = result.RootElement;
            Assert.Equal(matching ? "alice" : "bob", data.GetProperty("persona").GetProperty("name").GetString());
            Assert.Equal(matching, data.GetProperty("flags").GetProperty("filter-targeting").GetBoolean());
            Assert.Equal(matching, data.GetProperty("flags").GetProperty("ExpressCheckout").GetBoolean());
            Assert.Equal(matching ? "preview" : "classic", data.GetProperty("variant").GetString());
        }));
    }

    [Fact]
    public async Task Mvc_gate_and_feature_aware_openapi_agree_on_allowed_and_denied_routes()
    {
        foreach (var enabled in new[] { true, false })
        {
            await using var app = new SampleFactory(new() { ["Sample:BetaEnabled"] = enabled.ToString() });
            using var client = app.CreateClient();
            Assert.Equal(enabled ? HttpStatusCode.OK : HttpStatusCode.NotFound, (await client.GetAsync("/api/beta")).StatusCode);
            using var schema = JsonDocument.Parse(await client.GetStringAsync("/swagger/v1/swagger.json"));
            Assert.Equal(enabled, schema.RootElement.GetProperty("paths").TryGetProperty("/api/beta", out _));
        }
    }

    [Fact]
    public async Task Native_Hangfire_registration_and_health_required_flag_follow_definitions()
    {
        foreach (var enabled in new[] { true, false })
        {
            await using var app = new SampleFactory(new() { ["Sample:SubmitEnabled"] = enabled.ToString(), ["Sample:ApiEnabled"] = enabled.ToString() });
            using var client = app.CreateClient();
            using var snapshot = JsonDocument.Parse(await client.GetStringAsync("/api/snapshot"));
            Assert.Equal(enabled, snapshot.RootElement.GetProperty("jobIds").EnumerateArray().Any(id => id.GetString() == "enhanced-submit-practice"));
            var health = await app.Services.GetRequiredService<HealthCheckService>().CheckHealthAsync();
            Assert.Equal(enabled ? HealthStatus.Healthy : HealthStatus.Degraded, health.Status);
        }
    }
}
