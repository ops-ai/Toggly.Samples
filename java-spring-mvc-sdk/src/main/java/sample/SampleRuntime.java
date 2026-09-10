package sample;

import io.toggly.core.TogglyClient;
import io.toggly.core.config.TogglyConfig;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/** Application lifetime, not user lifetime. Each evaluation receives its own request context. */
public final class SampleRuntime implements AutoCloseable {
    private final String appKey, environment, baseUrl;
    private final long pollSeconds;
    private TogglyClient client;
    public final AtomicInteger errors = new AtomicInteger();
    public SampleRuntime(String appKey, String environment, String baseUrl, long pollSeconds) {
        this.appKey = appKey == null ? "" : appKey.trim(); this.environment = environment;
        this.baseUrl = baseUrl; this.pollSeconds = pollSeconds;
    }
    public static SampleRuntime fromEnvironment(Map<String, String> env) {
        return new SampleRuntime(env.get("TOGGLY_APP_KEY"), env.getOrDefault("TOGGLY_ENVIRONMENT", "Production"),
                "https://definitions.toggly.io", 60);
    }
    public static SampleRuntime unconfigured() { return fromEnvironment(Map.of()); }
    public boolean configured() { return !appKey.isBlank(); }
    public TogglyClient client() { return client; }
    void start() {
        // An empty key means setup mode, with no synthetic key, remote request, or client.
        if (!configured()) return;
        var config = TogglyConfig.builder().appKey(appKey).environment(environment).baseUrl(baseUrl)
                .useSignedDefinitions(true).defaultFeatureState(false).refreshIntervalSeconds(pollSeconds)
                .enableLiveUpdates(false).enableUsageTracking(false).enableMetrics(false)
                .registerContextsOnStartup(false).onError((message, error) -> errors.incrementAndGet()).build();
        // Passing no custom provider gives the client ownership of its real HTTP provider.
        client = new TogglyClient(config);
        client.refresh();
    }
    @Override public void close() {
        // Main closes this once, after Tomcat has finished requests and destroyed Spring MVC.
        if (client != null) { client.close(); client = null; }
    }
}
