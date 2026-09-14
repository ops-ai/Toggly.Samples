using EmbeddedDashboardSample.Features;
using EmbeddedDashboardSample.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.FeatureManagement;
using Microsoft.FeatureManagement.Mvc;
using Toggly.FeatureManagement.Embedded;

namespace EmbeddedDashboardSample.Controllers;

public sealed class ShowcaseController(IFeatureManager features, EmbeddedCatalogCoordinator catalog) : Controller
{
    // Use the non-snapshot manager when comparing different entities (including no
    // entity) for one key. IFeatureManagerSnapshot caches by key within a request.
    private async Task<WorkshopModel> Snapshot()
    {
        var persona = SamplePersonas.Current(HttpContext);
        var flags = new Dictionary<string, bool>();
        foreach (var key in FeatureFlags.Demo.Concat(FeatureFlags.Filters))
            flags[key] = key is FeatureFlags.Express or "filter-context-property"
                ? await features.IsEnabledAsync(key, persona.Order)
                : await features.IsEnabledAsync(key);
        return new(persona, flags, await features.IsEnabledAsync(FeatureFlags.Express),
            catalog.Diagnostics.StorageState.ToString(), catalog.Diagnostics.ActiveRevision);
    }

    public async Task<IActionResult> Index() => View(await Snapshot());
    [HttpGet("/gates")] public async Task<IActionResult> Gates() => View(await Snapshot());
    [HttpGet("/programmatic")] public async Task<IActionResult> Programmatic() => View(await Snapshot());
    [HttpGet("/identity")] public async Task<IActionResult> Identity() => View(await Snapshot());
    [HttpGet("/orders")] public async Task<IActionResult> Orders() => View(await Snapshot());
    [HttpGet("/filters")] public async Task<IActionResult> Filters() => View(await Snapshot());
    [HttpGet("/integrations")] public async Task<IActionResult> Integrations() => View(await Snapshot());
    [HttpGet("/api/snapshot")] public async Task<IActionResult> State() => Json(await Snapshot());

    // A real MVC feature gate controls reachability, not just page presentation.
    // Feature enablement is NOT authentication; protect sensitive operations separately.
    [HttpGet("/api/beta")]
    [FeatureGate(FeatureFlags.Beta)]
    public IActionResult Beta() => Ok(new { message = "Beta endpoint is enabled", feature = FeatureFlags.Beta });
}
