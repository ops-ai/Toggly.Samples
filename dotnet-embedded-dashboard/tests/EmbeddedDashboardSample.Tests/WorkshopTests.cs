using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Toggly.FeatureManagement.Catalog;
using Toggly.FeatureManagement.Embedded;
using Xunit;

namespace EmbeddedDashboardSample.Tests;

public sealed class WorkshopTests
{
    [Fact]
    public async Task Empty_start_teaches_explicit_initialization_without_an_app_key()
    {
        using var database = new TestDatabase();
        await using var app = new SampleFactory(database.Path);
        using var client = app.CreateClient();
        var html = await client.GetStringAsync("/");
        Assert.Contains("No account or app key", html);
        Assert.Contains("Initialize or import", html);
        var snapshot = await Snapshot(client);
        Assert.Equal("Uninitialized", snapshot.GetProperty("storageState").GetString());
        Assert.All(snapshot.GetProperty("flags").EnumerateObject(), flag => Assert.False(flag.Value.GetBoolean()));
        Assert.Null(await app.Services.GetRequiredService<EmbeddedCatalogEditor>().ReadAsync());
    }

    [Fact]
    public async Task Imported_catalog_evaluates_targeting_and_entities_per_request()
    {
        using var database = new TestDatabase();
        await using var app = new SampleFactory(database.Path);
        using var client = app.CreateClient();
        await Import(app);
        var matching = await Snapshot(client, "matching");
        var nonmatching = await Snapshot(client, "nonmatching");
        foreach (var key in new[] { "filter-targeting", "filter-user-claims", "filter-country", "filter-browser-family", "filter-browser-language", "filter-device-type", "filter-os", "filter-context-property", "ExpressCheckout" })
        {
            Assert.True(matching.GetProperty("flags").GetProperty(key).GetBoolean(), key);
            Assert.False(nonmatching.GetProperty("flags").GetProperty(key).GetBoolean(), key);
        }
        Assert.False(matching.GetProperty("expressWithoutEntity").GetBoolean());
        Assert.False((await Snapshot(client, "matching&order=standard")).GetProperty("flags").GetProperty("ExpressCheckout").GetBoolean());
        Assert.True((await Snapshot(client, "matching")).GetProperty("flags").GetProperty("filter-targeting").GetBoolean());
    }

    [Fact]
    public async Task Razor_gates_and_controller_gate_follow_actual_catalog_edits()
    {
        using var database = new TestDatabase();
        await using var app = new SampleFactory(database.Path);
        using var client = app.CreateClient();
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/beta")).StatusCode);
        Assert.Contains("id=\"dashboard-off\"", await client.GetStringAsync("/gates"));
        await Import(app);
        var gates = await client.GetStringAsync("/gates?preset=matching");
        Assert.Contains("id=\"dashboard-on\"", gates);
        Assert.Contains("id=\"all-gate\"", gates);
        Assert.DoesNotContain("id=\"dashboard-off\"", gates);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/beta")).StatusCode);
    }

    [Fact]
    public async Task Packaged_dashboard_previews_applies_and_exports_the_portable_catalog()
    {
        using var database = new TestDatabase();
        await using var app = new SampleFactory(database.Path);
        using var client = app.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        var uploadForm = await client.GetStringAsync("/internal/features/import");
        var token = FormFields(uploadForm).Single(field => field.Key == "__RequestVerificationToken").Value;
        using var upload = new MultipartFormDataContent();
        upload.Add(new StringContent(token), "__RequestVerificationToken");
        upload.Add(new ByteArrayContent(await File.ReadAllBytesAsync(System.IO.Path.Combine(AppContext.BaseDirectory, "example-catalog.json"))), "catalog", "example-catalog.json");
        var preview = await client.PostAsync("/internal/features/import/preview", upload);
        var previewHtml = await preview.Content.ReadAsStringAsync();
        Assert.True(preview.IsSuccessStatusCode, previewHtml);
        Assert.Contains("Add 16 features", previewHtml);
        Assert.Null(await app.Services.GetRequiredService<EmbeddedCatalogEditor>().ReadAsync());
        var applied = await client.PostAsync("/internal/features/import/apply", new FormUrlEncodedContent(FormFields(previewHtml)));
        Assert.Equal(HttpStatusCode.SeeOther, applied.StatusCode);
        var export = await client.GetAsync("/internal/features/export");
        Assert.Equal(HttpStatusCode.OK, export.StatusCode);
        Assert.True(export.Headers.CacheControl!.NoStore);
        var document = CatalogJson.Parse(await export.Content.ReadAsStringAsync());
        Assert.Equal(16, document.Features.Count);
        Assert.True((await Snapshot(client)).GetProperty("flags").GetProperty("new-dashboard").GetBoolean());
    }

    private static IEnumerable<KeyValuePair<string, string>> FormFields(string html) =>
        System.Text.RegularExpressions.Regex.Matches(html, """<input\b[^>]*\bname="([^"]+)"[^>]*\bvalue="([^"]*)"[^>]*>""")
            .Select(match => new KeyValuePair<string, string>(WebUtility.HtmlDecode(match.Groups[1].Value), WebUtility.HtmlDecode(match.Groups[2].Value)));

    [Fact]
    public async Task Edits_survive_restart_and_disabled_rules_are_retained()
    {
        using var database = new TestDatabase();
        await using (var first = new SampleFactory(database.Path))
        {
            using var client = first.CreateClient();
            await Import(first);
            var editor = first.Services.GetRequiredService<EmbeddedCatalogEditor>();
            var current = (await editor.ReadAsync())!;
            current.Document.Features.Single(feature => feature.Key == "filter-targeting").Enabled = false;
            Assert.Equal(CatalogWriteStatus.Written, (await editor.TryWriteAsync(current.Document, current.Revision)).Status);
            Assert.False((await Snapshot(client, "matching")).GetProperty("flags").GetProperty("filter-targeting").GetBoolean());
        }
        await using var restarted = new SampleFactory(database.Path);
        using var nextClient = restarted.CreateClient();
        var nextEditor = restarted.Services.GetRequiredService<EmbeddedCatalogEditor>();
        var persisted = (await nextEditor.ReadAsync())!;
        var feature = persisted.Document.Features.Single(feature => feature.Key == "filter-targeting");
        Assert.False(feature.Enabled);
        Assert.Equal("alice-users", Assert.Single(feature.Rules).Parameters["Audience.Users"]);
        feature.Enabled = true;
        await nextEditor.TryWriteAsync(persisted.Document, persisted.Revision);
        Assert.True((await Snapshot(nextClient, "matching")).GetProperty("flags").GetProperty("filter-targeting").GetBoolean());
    }

    [Theory]
    [InlineData("/internal/features")]
    [InlineData("/internal/features/assets/dashboard.css")]
    [InlineData("/internal/features/export")]
    public async Task Demo_identity_never_grants_remote_dashboard_access(string path)
    {
        using var database = new TestDatabase();
        await using var app = new SampleFactory(database.Path);
        using var client = app.CreateClient();
        client.DefaultRequestHeaders.Add("X-Test-Remote", "203.0.113.1");
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync(path + "?preset=matching")).StatusCode);
    }

    [Fact]
    public async Task Dashboard_is_local_and_mutations_require_antiforgery()
    {
        using var database = new TestDatabase();
        await using var app = new SampleFactory(database.Path);
        using var client = app.CreateClient();
        Assert.Contains("Features", await client.GetStringAsync("/internal/features"));
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsync("/internal/features/initialize", new FormUrlEncodedContent([]))).StatusCode);
        client.DefaultRequestHeaders.Add("X-Forwarded-For", "203.0.113.1");
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/internal/features")).StatusCode);
    }

    private static async Task<JsonElement> Snapshot(HttpClient client, string preset = "matching") =>
        await client.GetFromJsonAsync<JsonElement>("/api/snapshot?preset=" + preset);

    private static async Task Import(SampleFactory app)
    {
        var catalog = CatalogJson.Parse(await File.ReadAllTextAsync(System.IO.Path.Combine(AppContext.BaseDirectory, "example-catalog.json")));
        var result = await app.Services.GetRequiredService<EmbeddedCatalogEditor>().TryWriteAsync(catalog, null);
        Assert.Equal(CatalogWriteStatus.Written, result.Status);
    }
}

internal sealed class TestDatabase : IDisposable
{
    private readonly string _directory = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "toggly-sample-" + Guid.NewGuid().ToString("N"));
    public TestDatabase() => Directory.CreateDirectory(_directory);
    public string Path => System.IO.Path.Combine(_directory, "catalog.db");
    public void Dispose() => Directory.Delete(_directory, true);
}

internal sealed class SampleFactory(string databasePath) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("ConnectionStrings:TogglyCatalog", $"Data Source={databasePath};Pooling=False");
        builder.ConfigureServices(services => services.AddSingleton<IStartupFilter, TestConnectionFilter>());
    }
}

// TestServer has no socket peer. Supply a peer only in this test host; the sample
// itself never trusts a request header to determine its remote address.
internal sealed class TestConnectionFilter : IStartupFilter
{
    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
    {
        app.Use((context, continuation) =>
        {
            context.Connection.RemoteIpAddress = IPAddress.Parse(context.Request.Headers["X-Test-Remote"].FirstOrDefault() ?? "127.0.0.1");
            return continuation(context);
        });
        next(app);
    };
}
