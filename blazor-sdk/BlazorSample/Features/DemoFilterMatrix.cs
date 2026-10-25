using Microsoft.FeatureManagement;

namespace BlazorSample.Features;

/// <summary>Evaluates the demo filter matrix in-process on the current HTTP request.</summary>
public sealed class DemoFilterMatrix(IFeatureManager features, IHttpContextAccessor accessor)
{
    private static readonly string[] Keys = FilterMatrixApi.FilterKeys;

    public async Task<Dictionary<string, bool>> EvaluatePresetAsync(string preset)
    {
        var http = accessor.HttpContext
            ?? throw new InvalidOperationException("HttpContext is required for filter-matrix evaluation.");

        var resolved =
            http.Request.Query["preset"].FirstOrDefault()
            ?? http.Request.Headers["x-demo-preset"].FirstOrDefault()
            ?? http.Request.Cookies["sample-preset"]
            ?? http.Request.Cookies["toggly-preset"]
            ?? preset;
        var (persona, applyHeaders) = DemoPersona.FromPreset(resolved);
        if (http.Request.Query["order"] == "standard")
            persona = persona with { Order = DemoPersona.NonMatching.Order };
        if (http.Request.Query["order"] == "vip")
            persona = persona with { Order = DemoPersona.Matching.Order };
        DemoPersona.ApplyRequestHeaders(http, persona, applyHeaders);
        var order = persona.Order;

        var values = new Dictionary<string, bool>(StringComparer.Ordinal);
        foreach (var key in Keys)
        {
            values[key] = key switch
            {
                // AddTogglyBlazorServer registers circuit/native filters only (see package README).
                // Canonical filter-country is Country US at 100%; persona sets CF-IPCountry for SSR.
                "filter-country" => applyHeaders
                    && string.Equals(persona.Country, "US", StringComparison.OrdinalIgnoreCase),
                "filter-context-property" => await features.IsEnabledAsync(key, order),
                _ => await features.IsEnabledAsync(key),
            };
        }

        return values;
    }
}
