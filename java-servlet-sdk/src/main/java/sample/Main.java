package sample;

import io.toggly.servlet.FeatureGateFilter;
import io.toggly.servlet.TogglyServlet;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.apache.catalina.startup.Tomcat;
import org.apache.tomcat.util.descriptor.web.FilterDef;
import org.apache.tomcat.util.descriptor.web.FilterMap;
import java.nio.file.*;
import java.util.Comparator;
import java.util.Map;

/** Standalone Servlet 6.1 host: no Spring adapter or SDK source reference. */
public final class Main implements AutoCloseable {
    private final Tomcat tomcat;
    private final Path work;
    private Main(Tomcat tomcat, Path work) { this.tomcat = tomcat; this.work = work; }
    public static void main(String[] args) throws Exception {
        var app = start(8086, SampleLifecycle.fromEnvironment(System.getenv()));
        Runtime.getRuntime().addShutdownHook(new Thread(() -> { try { app.close(); } catch (Exception e) { System.err.println("Sample shutdown failed"); } }));
        System.out.println("Java Servlet SDK Sample: http://localhost:8086");
        app.tomcat.getServer().await();
    }
    public static Main start(int port, SampleLifecycle lifecycle) throws Exception { return start(port, lifecycle, null); }
    static Main start(int port, SampleLifecycle lifecycle, Filter observation) throws Exception { return start(port, lifecycle, observation, null); }
    static Main start(int port, SampleLifecycle lifecycle, Filter observation, Filter downstream) throws Exception {
        Path work = Files.createTempDirectory("toggly-servlet-");
        var tomcat = new Tomcat();
        tomcat.setBaseDir(work.toString());
        tomcat.setPort(port);
        tomcat.getConnector().setProperty("address", "127.0.0.1");
        tomcat.getConnector().setProperty("maxThreads", "8");
        var context = tomcat.addContext("", work.toString());
        context.setApplicationLifecycleListeners(new Object[]{lifecycle});
        // Tests add an outer observer to prove native cleanup on the actual worker thread.
        if (observation != null) addFilter(context, "observation", observation, "/*", Map.of());
        addFilter(context, "headers-and-unconfigured-guard", (request, response, chain) -> {
            var req = (HttpServletRequest) request;
            var res = (HttpServletResponse) response;
            res.setHeader("Cache-Control", "no-store");
            res.setHeader("X-Content-Type-Options", "nosniff");
            res.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'self'; form-action 'self'; frame-ancestors 'none'");
            // Native FeatureGateFilter passes through without a client; make that startup policy explicit.
            if (req.getRequestURI().startsWith("/gated/") && !lifecycle.configured()) {
                res.setStatus(503); res.setContentType("text/plain"); res.getWriter().write("Missing TOGGLY_APP_KEY: protected example unavailable"); return;
            }
            chain.doFilter(request, response);
        }, "/*", Map.of());
        addFilter(context, "request-context", new DemoContextFilter(), "/*", Map.of());
        if (downstream != null) addFilter(context, "test-downstream", downstream, "/*", Map.of());
        gate(context, "feature", "new-dashboard", "ALL", false);
        gate(context, "negate", "new-dashboard", "ALL", true);
        gate(context, "all", "new-dashboard,api-v2", "ALL", false);
        gate(context, "any", "new-dashboard,api-v2", "ANY", false);
        gate(context, "beta", "beta-access", "ALL", false);
        // This endpoint is the published TogglyServlet itself, not a sample imitation.
        Tomcat.addServlet(context, "native-api", new TogglyServlet());
        context.addServletMappingDecoded("/api/features/*", "native-api");
        Tomcat.addServlet(context, "showcase", new ShowcaseServlet(lifecycle));
        context.addServletMappingDecoded("/", "showcase");
        var app = new Main(tomcat, work);
        try { tomcat.start(); return app; } catch (Exception error) { app.close(); throw error; }
    }
    private static void gate(org.apache.catalina.Context c, String name, String features, String requirement, boolean negate) {
        addFilter(c, name, new FeatureGateFilter(), "/gated/" + name,
                Map.of("features", features, "requirement", requirement, "negate", Boolean.toString(negate), "blockedStatus", "404"));
    }
    static void addFilter(org.apache.catalina.Context c, String name, Filter filter, String path, Map<String, String> params) {
        var def = new FilterDef(); def.setFilterName(name); def.setFilter(filter); params.forEach(def::addInitParameter); c.addFilterDef(def);
        var mapping = new FilterMap(); mapping.setFilterName(name); mapping.addURLPattern(path); c.addFilterMap(mapping);
    }
    public String url() { return "http://127.0.0.1:" + tomcat.getConnector().getLocalPort(); }
    @Override public void close() throws Exception {
        try { tomcat.stop(); } finally {
            tomcat.destroy();
            try (var paths = Files.walk(work)) { for (Path p : paths.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(p); }
        }
    }
}
