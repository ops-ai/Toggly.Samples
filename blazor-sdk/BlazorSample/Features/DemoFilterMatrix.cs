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

        var (persona, applyHeaders) = DemoPersona.FromPreset(preset);
        if (http.Request.Query["order"] == "standard")
            persona = persona with { Order = DemoPersona.NonMatching.Order };
        if (http.Request.Query["order"] == "vip")
            persona = persona with { Order = DemoPersona.Matching.Order };
        DemoPersona.ApplyRequestHeaders(http, persona, applyHeaders);
        var order = persona.Order;

        var values = new Dictionary<string, bool>(StringComparer.Ordinal);
        foreach (var key in Keys)
        {
            values[key] =
                key is "filter-context-property"
                    ? await features.IsEnabledAsync(key, order)
                    : await features.IsEnabledAsync(key);
        }

        return values;
    }
}
