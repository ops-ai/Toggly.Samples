using DotnetSample.Features;
using DotnetSample.Models;
using Hangfire;
using Hangfire.Storage;
using Microsoft.AspNetCore.Mvc;
using Microsoft.FeatureManagement;
using Toggly.FeatureManagement;

namespace DotnetSample.Controllers;

[ApiExplorerSettings(IgnoreApi = true)]
public sealed class ShowcaseController(IFeatureManager features, IVariantFeatureManager variants,
    IFeatureProviderDebug diagnostics, SampleMode mode, JobStorage jobs) : Controller
{
    // Each page evaluates current SDK state on this request. There is no sample
    // background browser cache, so refresh the page after a dashboard change.
    private async Task<ShowcaseModel> Snapshot()
    {
        var persona = SamplePersonas.Current(HttpContext);
        var values = new Dictionary<string, bool>();
        // Sequential calls also keep request-local usage tracking deterministic.
        foreach (var key in FeatureFlags.Demo.Concat(FeatureFlags.Filters))
            values[key] = key is FeatureFlags.Express or "filter-context-property"
                ? await features.IsEnabledAsync(key, persona.Order) : await features.IsEnabledAsync(key);
        var variant = await variants.GetVariantAsync(FeatureFlags.Dashboard, persona.Targeting);
        var debug = diagnostics.GetDebugInfo();
        using var connection = jobs.GetConnection();
        return new(persona, mode.Offline, values, variant?.Name, variant?.Configuration?["title"],
            await features.IsEnabledAsync(FeatureFlags.Express),
            await features.IsEnabledAsync(FeatureFlags.Express, new { Id = "unknown", Vip = true }),
            debug.LastDefinitionsCheck, debug.Loaded, debug.WebsocketClientRunning,
            connection.GetRecurringJobs().Select(job => job.Id).ToArray());
    }
    public async Task<IActionResult> Index() => View(await Snapshot());
    [HttpGet("/gates")] public async Task<IActionResult> Gates() => View(await Snapshot());
    [HttpGet("/programmatic")] public async Task<IActionResult> Programmatic() => View(await Snapshot());
    [HttpGet("/identity")] public async Task<IActionResult> Identity() => View(await Snapshot());
    [HttpGet("/orders")] public async Task<IActionResult> Orders() => View(await Snapshot());
    [HttpGet("/filters")] public async Task<IActionResult> Filters() => View(await Snapshot());
    [HttpGet("/integrations")] public async Task<IActionResult> Integrations() => View(await Snapshot());
    [HttpGet("/api/snapshot")] public async Task<IActionResult> State() => Json(await Snapshot());

    [HttpPost("/identity")]
    [ValidateAntiForgeryToken]
    public IActionResult SaveIdentity(string preset)
    {
        // Cookie is a sample preference only. No credential is stored here.
        if (preset == "anonymous") Response.Cookies.Delete("sample-preset");
        else Response.Cookies.Append("sample-preset", preset == "nonmatching" ? "nonmatching" : "matching",
            new CookieOptions { HttpOnly = true, SameSite = SameSiteMode.Lax, IsEssential = true });
        return Redirect("/identity" + (preset == "anonymous" ? "?preset=anonymous" : ""));
    }
}
