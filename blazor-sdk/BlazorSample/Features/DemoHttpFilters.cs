namespace BlazorSample.Features;

/// <summary>
/// In-process HTTP segment evaluation for the demo matrix when
/// <c>AddTogglyBlazorServer</c> omits web request filters (see package README).
/// </summary>
internal static class DemoHttpFilters
{
    internal static bool? TryEvaluate(string key, DemoPersona persona, bool applyHeaders)
    {
        if (!applyHeaders)
            return key switch
            {
                "filter-user-claims"
                    or "filter-country"
                    or "filter-browser-family"
                    or "filter-browser-language"
                    or "filter-device-type"
                    or "filter-os" => false,
                _ => null,
            };

        return key switch
        {
            "filter-user-claims" => string.Equals(persona.Role, "admin", StringComparison.OrdinalIgnoreCase),
            "filter-country" => string.Equals(persona.Country, "US", StringComparison.OrdinalIgnoreCase),
            "filter-browser-family" => persona.Agent.Contains("Chrome", StringComparison.OrdinalIgnoreCase),
            "filter-browser-language" => persona.Language.StartsWith("en", StringComparison.OrdinalIgnoreCase),
            "filter-device-type" => persona.Agent.Contains("Macintosh", StringComparison.OrdinalIgnoreCase),
            "filter-os" => persona.Agent.Contains("Mac OS X", StringComparison.OrdinalIgnoreCase),
            _ => null,
        };
    }
}
