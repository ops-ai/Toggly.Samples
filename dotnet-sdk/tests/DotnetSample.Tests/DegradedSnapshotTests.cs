using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.FeatureManagement;
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
    }
}

internal sealed class ThrowingFeatureFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder) => builder.ConfigureServices(services =>
    {
        var existing = services.Single(descriptor => descriptor.ServiceType == typeof(IFeatureManager));
        services.Remove(existing);
        services.AddSingleton<IFeatureManager, ThrowingFeatureManager>();
    });
}

internal sealed class ThrowingFeatureManager : IFeatureManager
{
    public IAsyncEnumerable<string> GetFeatureNamesAsync() => AsyncEnumerable.Empty<string>();

    public Task<bool> IsEnabledAsync(string feature) =>
        throw new InvalidOperationException("Simulated live evaluation failure");

    public Task<bool> IsEnabledAsync<TContext>(string feature, TContext context) =>
        throw new InvalidOperationException("Simulated live evaluation failure");
}
