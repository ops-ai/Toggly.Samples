package sample;

import io.toggly.core.context.TogglyEntityContext;
import java.util.List;
import java.util.Map;

/** Shared vocabulary: the dashboard recipe and the UI use these exact keys. */
public final class Catalog {
    private Catalog() {}
    public static final List<String> PATHS = List.of("/", "/gates", "/programmatic", "/identity", "/orders", "/filters", "/webflux", "/configuration");
    public static final List<String> TITLES = List.of("Home", "Declarative gates", "Programmatic API", "Identity", "Entity context", "Filters matrix", "Spring WebFlux integration", "Configuration");
    public static final List<String> FLAGS = List.of("new-dashboard", "api-v2", "enhanced-submit", "ExpressCheckout", "beta-access",
            "filter-always-on", "filter-percentage", "filter-targeting", "filter-user-claims", "filter-time-window",
            "filter-country", "filter-browser-family", "filter-browser-language", "filter-device-type", "filter-os", "filter-context-property");
    public static final List<String> FILTERS = FLAGS.subList(5, FLAGS.size());
    public static final String MATCHING_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    public static final String NONMATCHING_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0";

    public static TogglyEntityContext order(boolean vip) {
        String id = vip ? "ord-vip" : "ord-standard";
        // Entity kind/key are separate from user identity. Never cache this result by flag name alone.
        return new TogglyEntityContext("Order", id, Map.of("Id", id, "Vip", vip, "Total", vip ? 250.0 : 75.0));
    }
}
