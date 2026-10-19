using System.Net;
using DotnetSample.Features;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.FeatureManagement;
using Microsoft.FeatureManagement.FeatureFilters;
using Xunit;

namespace DotnetSample.Tests;

public class DegradedSnapshotTests
{
    [Fact]
    public async Task Home_returns_ok_when_feature_evaluation_throws()
    {
        await using var app = new ThrowingFeatureFactory();
        using var client = app.CreateClient();
        var response = await client.GetAsync("/");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("Ship one app", body);
        Assert.Contains("not loaded; defaults OFF", body);
        Assert.Contains("toggly-evaluation-degraded", body);
        Assert.Equal("evaluation-failed", response.Headers.GetValues(TogglyEvaluationDegraded.ResponseHeaderName).Single());
    }

    [Fact]
    public async Task Gates_page_survives_tag_helper_evaluation_when_features_throw()
    {
        await using var app = new ThrowingFeatureFactory();
        using var client = app.CreateClient();
        var response = await client.GetAsync("/gates");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("toggly-evaluation-degraded", await response.Content.ReadAsStringAsync());
    }
}

internal sealed class ThrowingFeatureFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder) => builder.ConfigureServices(services =>
    {
        ReplaceFeatureManager(services);
        ReplaceVariantFeatureManager(services);
        ReplaceFeatureManagerSnapshot(services);
    });

    private static void ReplaceFeatureManager(IServiceCollection services)
    {
        services.Remove(services.Single(descriptor => descriptor.ServiceType == typeof(IFeatureManager)));
        services.AddSingleton<ThrowingFeatureManager>();
        services.AddSingleton<IFeatureManager>(sp => new ResilientFeatureManager(
            sp.GetRequiredService<ThrowingFeatureManager>(), sp.GetRequiredService<IHttpContextAccessor>(),
            sp.GetRequiredService<ILogger<ResilientFeatureManager>>()));
    }

    private static void ReplaceVariantFeatureManager(IServiceCollection services)
    {
        services.Remove(services.Single(descriptor => descriptor.ServiceType == typeof(IVariantFeatureManager)));
        services.AddSingleton<ThrowingVariantFeatureManager>();
        services.AddSingleton<IVariantFeatureManager>(sp => new ResilientVariantFeatureManager(
            sp.GetRequiredService<ThrowingVariantFeatureManager>(), sp.GetRequiredService<IHttpContextAccessor>(),
            sp.GetRequiredService<ILogger<ResilientVariantFeatureManager>>()));
    }

    private static void ReplaceFeatureManagerSnapshot(IServiceCollection services)
    {
        services.Remove(services.Single(descriptor => descriptor.ServiceType == typeof(IFeatureManagerSnapshot)));
        services.AddSingleton<ThrowingFeatureManagerSnapshot>();
        services.AddSingleton<IFeatureManagerSnapshot>(sp => new ResilientFeatureManagerSnapshot(
            sp.GetRequiredService<ThrowingFeatureManagerSnapshot>(), sp.GetRequiredService<IHttpContextAccessor>(),
            sp.GetRequiredService<ILogger<ResilientFeatureManagerSnapshot>>()));
    }
}

internal sealed class ThrowingFeatureManager : IFeatureManager
{
    public IAsyncEnumerable<string> GetFeatureNamesAsync() => AsyncEnumerable.Empty<string>();

    public Task<bool> IsEnabledAsync(string feature) =>
        throw new InvalidOperationException("Simulated live evaluation failure");

    public Task<bool> IsEnabledAsync<TContext>(string feature, TContext context) =>
        throw new InvalidOperationException("Simulated live evaluation failure");
}

internal sealed class ThrowingVariantFeatureManager : IVariantFeatureManager
{
    public IAsyncEnumerable<string> GetFeatureNamesAsync(CancellationToken cancellationToken = default) =>
        AsyncEnumerable.Empty<string>();

    public ValueTask<bool> IsEnabledAsync(string feature, CancellationToken cancellationToken = default) =>
        throw new InvalidOperationException("Simulated live evaluation failure");

    public ValueTask<bool> IsEnabledAsync<TContext>(string feature, TContext context,
        CancellationToken cancellationToken = default) =>
        throw new InvalidOperationException("Simulated live evaluation failure");

    public ValueTask<Variant> GetVariantAsync(string feature, CancellationToken cancellationToken = default) =>
        throw new InvalidOperationException("Simulated live evaluation failure");

    public ValueTask<Variant> GetVariantAsync(string feature, ITargetingContext context,
        CancellationToken cancellationToken = default) =>
        throw new InvalidOperationException("Simulated live evaluation failure");
}

internal sealed class ThrowingFeatureManagerSnapshot : IFeatureManagerSnapshot
{
    public IAsyncEnumerable<string> GetFeatureNamesAsync() => AsyncEnumerable.Empty<string>();

    public Task<bool> IsEnabledAsync(string feature) =>
        throw new InvalidOperationException("Simulated live evaluation failure");

    public Task<bool> IsEnabledAsync<TContext>(string feature, TContext context) =>
        throw new InvalidOperationException("Simulated live evaluation failure");
}
