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

        var explicitPreset =
            !string.IsNullOrWhiteSpace(preset) && !string.Equals(preset, "anonymous", StringComparison.Ordinal)
                ? preset
                : null;
        var resolved =
            http.Request.Query["preset"].FirstOrDefault()
            ?? http.Request.Headers["x-demo-preset"].FirstOrDefault()
            ?? explicitPreset
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
            if (DemoHttpFilters.TryEvaluate(key, persona, applyHeaders) is bool httpValue)
            {
                values[key] = httpValue;
                continue;
            }

            try
            {
                values[key] =
                    key == "filter-context-property"
                        ? await features.IsEnabledAsync(key, order)
                        : await features.IsEnabledAsync(key);
            }
            catch (FeatureManagementException)
            {
                values[key] = false;
            }
        }

        return values;
    }
}
