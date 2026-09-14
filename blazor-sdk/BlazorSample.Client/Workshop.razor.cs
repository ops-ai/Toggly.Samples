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
    private static readonly HashSet<string> UnsupportedServer =
    [
        "filter-user-claims",
        "filter-country",
        "filter-browser-family",
        "filter-browser-language",
        "filter-device-type",
        "filter-os",
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

    protected override void OnInitialized()
    {
        Features.Changed += Changed;
        Features.Error += Failed;
    }

    protected override async Task OnParametersSetAsync()
    {
        if (Mode == "ssr")
            await SetPreset(
                Navigation
                    .ToAbsoluteUri(Navigation.Uri)
                    .Query.Contains("preset=matching", StringComparison.Ordinal)
            );
        else
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
        foreach (
            var key in Flags
                .Concat(Filters)
                .Where(key => OperatingSystem.IsBrowser() || !UnsupportedServer.Contains(key))
        )
            Values[key] = await Features.EvaluateAsync(
                [key],
                entity: key is "ExpressCheckout" or "filter-context-property" ? CurrentOrder : null
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
            ? "Browser endpoint evaluation; not built into trusted Blazor circuit adapter"
            : "Trusted server + signed browser definitions";

    public void Dispose()
    {
        disposed = true;
        Features.Changed -= Changed;
        Features.Error -= Failed;
    }
}
