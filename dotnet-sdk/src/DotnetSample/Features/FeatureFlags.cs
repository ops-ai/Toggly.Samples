namespace DotnetSample.Features;

// These strings intentionally match the shared catalog. C# enum members cannot
// contain hyphens, so constants preserve the dashboard keys without conversion.
public static class FeatureFlags
{
    public const string Dashboard = "new-dashboard";
    public const string Api = "api-v2";
    public const string Submit = "enhanced-submit";
    public const string Express = "ExpressCheckout";
    public const string Beta = "beta-access";
    public static readonly string[] Demo = [Dashboard, Api, Submit, Express, Beta];
    public static readonly string[] Filters = ["filter-always-on", "filter-percentage", "filter-targeting",
        "filter-user-claims", "filter-time-window", "filter-country", "filter-browser-family",
        "filter-browser-language", "filter-device-type", "filter-os", "filter-context-property"];
}
