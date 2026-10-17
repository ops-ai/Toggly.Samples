namespace DotnetSample.Features;

internal static class TogglyPracticeMode
{
    // LiveE2E and other automation use non-secret placeholder keys. Treat them like
    // missing keys so the sample stays on fixture definitions and responds quickly.
    public static bool IsOffline(string? appKey) =>
        string.IsNullOrWhiteSpace(appKey)
        || appKey is "ci-placeholder"
            or "telemetry-test-only"
            or "offline-test-placeholder"
            or "placeholder"
            or "YOUR_APP_KEY"
            or "your-app-key";
}
