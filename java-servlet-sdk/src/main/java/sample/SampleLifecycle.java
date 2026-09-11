package sample;

import io.toggly.core.TogglyClient;
import io.toggly.core.config.TogglyConfig;
import io.toggly.servlet.TogglyServletContextListener;
import jakarta.servlet.ServletContext;
import jakarta.servlet.ServletContextEvent;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/** The native listener owns startup and close; this subclass supplies sample configuration. */
public final class SampleLifecycle extends TogglyServletContextListener {
    private final String appKey;
    private final String environment;
    private final String baseUrl;
    private final long pollSeconds;
    public final AtomicInteger errors = new AtomicInteger();

    public SampleLifecycle(String appKey, String environment, String baseUrl, long pollSeconds) {
        this.appKey = appKey == null ? "" : appKey.trim();
        this.environment = environment;
        this.baseUrl = baseUrl;
        this.pollSeconds = pollSeconds;
    }
    public static SampleLifecycle fromEnvironment(Map<String, String> env) {
        return new SampleLifecycle(env.get("TOGGLY_APP_KEY"), env.getOrDefault("TOGGLY_ENVIRONMENT", "Production"),
                "https://definitions.toggly.io", 60);
    }
    public static SampleLifecycle unconfigured() { return fromEnvironment(Map.of()); }
    public boolean configured() { return !appKey.isBlank(); }

    @Override protected TogglyConfig createConfig(ServletContext context) {
        return TogglyConfig.builder().appKey(appKey).environment(environment).baseUrl(baseUrl)
                .useSignedDefinitions(true).defaultFeatureState(false).refreshIntervalSeconds(pollSeconds)
                // Polling is enough for this small sample. No WebSocket URL (which contains the key) is logged.
                .enableLiveUpdates(false).enableUsageTracking(false).enableMetrics(false)
                .registerContextsOnStartup(false).onError((message, error) -> errors.incrementAndGet()).build();
    }
    @Override public void contextInitialized(ServletContextEvent event) {
        // Native TogglyClient rejects an empty app key. Do not invent one to make startup appear live.
        if (!configured()) return;
        super.contextInitialized(event);
        client(event.getServletContext()).refresh();
    }
    public static TogglyClient client(ServletContext context) {
        return (TogglyClient) context.getAttribute(TOGGLY_CLIENT_ATTR);
    }
    // contextDestroyed is deliberately inherited: the actual native listener closes client + scheduler.
}
