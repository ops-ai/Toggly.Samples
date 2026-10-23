using Microsoft.FeatureManagement;

namespace BlazorSample.Features;

public static class FilterMatrixApi
{
    private static readonly string[] Keys =
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

    public static void Map(WebApplication app)
    {
        app.MapGet(
            "/api/demo-filter-matrix",
            async (IFeatureManager features, HttpContext http) =>
            {
                var preset =
                    http.Request.Query["preset"].FirstOrDefault()
                    ?? http.Request.Cookies["sample-preset"]
                    ?? "anonymous";
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

                return Results.Json(values);
            }
        );
    }
}
