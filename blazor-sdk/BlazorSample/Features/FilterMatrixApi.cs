using Microsoft.FeatureManagement;

namespace BlazorSample.Features;

public static class FilterMatrixApi
{
    internal static readonly string[] FilterKeys =
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
            async (DemoFilterMatrix matrix, HttpContext http) =>
            {
                var preset =
                    http.Request.Query["preset"].FirstOrDefault()
                    ?? http.Request.Headers["x-demo-preset"].FirstOrDefault()
                    ?? http.Request.Cookies["sample-preset"]
                    ?? http.Request.Cookies["toggly-preset"]
                    ?? "anonymous";
                return Results.Json(await matrix.EvaluatePresetAsync(preset));
            }
        );
    }
}
