using System.Net.Http.Json;
using Microsoft.AspNetCore.Components;
using Toggly.FeatureManagement.Blazor;
using Toggly.FeatureManagement.Client;

namespace BlazorSample.Client;

/// <summary>Shared teaching interactions for the four render modes.</summary>
public partial class Workshop
{
    [Parameter]
    public string Mode { get; set; } = "server";

    [Parameter]
    public string Section { get; set; } = "home";
    private string Title => Sections.GetValueOrDefault(Section, "Blazor workshop");
    private static readonly Dictionary<string, string> Sections = new()
    {
        { "home", "Home" },
        { "gates", "Declarative gates" },
        { "api", "Programmatic API" },
        { "identity", "Identity" },
        { "entity", "Entity context" },
        { "filters", "Filters matrix" },
        { "framework", "Framework lifecycle" },
    };
    private static readonly string[] Flags =
    [
        "new-dashboard",
        "api-v2",
        "enhanced-submit",
        "ExpressCheckout",
        "beta-access",
    ];
    private static readonly string[] Filters =
    [
        "filter-always-on",
        "filter-percentage",
        "filter-targeting",
        "filter-time-window",
        "filter-user-claims",
        "filter-country",
        "filter-browser-family",
        "filter-browser-language",
        "filter-device-type",
        "filter-os",
        "filter-context-property",
    ];
    private static readonly EntityContext VipOrder = new(
        "Order",
        "ord-vip",
        new Dictionary<string, object?> { { "Vip", true }, { "Total", 150 } }
    );
    private static readonly EntityContext StandardOrder = new(
        "Order",
        "ord-standard",
        new Dictionary<string, object?> { { "Vip", false }, { "Total", 25 } }
    );
    private EntityContext CurrentOrder = VipOrder;
    private Dictionary<string, bool> Values = [];
    private string Identity = "anonymous";
    private int Updates;
    private string? Error;
    private bool disposed;
    private bool Interactive;

    protected override void OnInitialized()
    {
        Features.Changed += Changed;
        Features.Error += Failed;
    }

    protected override void OnAfterRender(bool firstRender)
    {
        // Prerendering has no event handlers and never invokes OnAfterRender.
        if (firstRender)
        {
            Interactive = true;
            StateHasChanged();
            // Only the filters section needs a post-circuit Evaluate on server; doing it
            // on identity/home stalled corrupt-snapshot persistence cases.
            if (Mode != "ssr" && !OperatingSystem.IsBrowser() && Section == "filters")
                _ = InvokeAsync(Evaluate);
        }
    }

    protected override async Task OnParametersSetAsync()
    {
        if (Mode == "ssr")
        {
            var query = Navigation.ToAbsoluteUri(Navigation.Uri).Query;
            var matching =
                !query.Contains("preset=nonmatching", StringComparison.Ordinal)
                && !query.Contains("preset=non-matching", StringComparison.Ordinal);
            await SetPreset(matching);
        }
        else if (OperatingSystem.IsBrowser())
            await Evaluate();
        else if (Interactive)
            await Evaluate();
    }

    // Demo presets change only this request, circuit or browser session.
    private async Task SetPreset(bool matching)
    {
        Identity = matching ? "alice" : "bob";
        CurrentOrder = matching ? VipOrder : StandardOrder;
        await Features.SetContextAsync(
            new(
                Identity,
                [matching ? "vip" : "standard"],
                new Dictionary<string, string> { { "role", matching ? "admin" : "user" } }
            )
        );
        await Evaluate();
    }

    private async Task Evaluate()
    {
        foreach (var key in Flags)
            Values[key] = await Features.EvaluateAsync(
                [key],
                entity: key is "ExpressCheckout" ? CurrentOrder : null
            );

        if (Section != "filters")
            return;

        // Loopback filter-matrix HTTP is only for the filters section; calling it elsewhere
        // can stall the Server circuit when signed snapshots are invalid.
        if (!OperatingSystem.IsBrowser())
        {
            try
            {
                var preset = Identity == "alice" ? "matching" : "nonmatching";
                var matrix = await Http.GetFromJsonAsync<Dictionary<string, bool>>(
                    Navigation.ToAbsoluteUri($"/api/demo-filter-matrix?preset={preset}")
                );
                if (matrix is not null)
                {
                    foreach (var key in Filters)
                        Values[key] = matrix.GetValueOrDefault(key);
                    return;
                }
            }
            catch (Exception ex)
            {
                Error = ex.Message;
            }
        }

        foreach (var key in Filters)
            Values[key] = await Features.EvaluateAsync(
                [key],
                entity: key is "filter-context-property" ? CurrentOrder : null
            );
    }

    private async Task Refresh()
    {
        await Features.RefreshAsync();
        await Evaluate();
    }

    // Definition notifications may arrive off the renderer synchronization context.
    private void Changed(object? sender, EventArgs args)
    {
        if (!disposed)
            _ = InvokeAsync(async () =>
            {
                if (disposed)
                {
                    return;
                }

                Updates++;
                if (OperatingSystem.IsBrowser() || Section == "filters")
                    await Evaluate();
                StateHasChanged();
            });
    }

    private void Failed(object? sender, Exception error)
    {
        if (!disposed)
            _ = InvokeAsync(() =>
            {
                Error = error.Message;
                StateHasChanged();
            });
    }

    private string Support(string key) =>
        key
            is "filter-user-claims"
                or "filter-country"
                or "filter-browser-family"
                or "filter-browser-language"
                or "filter-device-type"
                or "filter-os"
            ? OperatingSystem.IsBrowser()
                ? "Browser evaluated-signed endpoint with real request metadata"
                : "Trusted server HTTP filters via /api/demo-filter-matrix"
            : "Trusted server + signed browser definitions";

    public void Dispose()
    {
        disposed = true;
        Features.Changed -= Changed;
        Features.Error -= Failed;
    }
}
