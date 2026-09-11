package sample;

import jakarta.servlet.Filter;
import jakarta.servlet.http.HttpServletResponse;
import org.apache.catalina.startup.Tomcat;
import org.apache.tomcat.util.descriptor.web.FilterDef;
import org.apache.tomcat.util.descriptor.web.FilterMap;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.servlet.DispatcherServlet;
import java.nio.file.*;
import java.util.Comparator;

/** Actual production socket host. Spring, rather than a servlet facade, dispatches every application route. */
public final class Main implements AutoCloseable {
    private final Tomcat tomcat;
    private final Path work;
    private final SampleRuntime runtime;
    private Main(Tomcat tomcat, Path work, SampleRuntime runtime) {
        this.tomcat = tomcat; this.work = work; this.runtime = runtime;
    }
    public static void main(String[] args) throws Exception {
        var app = start(8088, SampleRuntime.fromEnvironment(System.getenv()));
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            try { app.close(); } catch (Exception error) { System.err.println("Sample shutdown failed"); }
        }));
        System.out.println("Java Spring MVC SDK Sample: http://localhost:8088"); app.tomcat.getServer().await();
    }
    public static Main start(int port, SampleRuntime runtime) throws Exception { return start(port, runtime, null); }
    static Main start(int port, SampleRuntime runtime, Filter observer) throws Exception {
        return start(port, runtime, observer, null);
    }
    static Main start(int port, SampleRuntime runtime, Filter observer, Class<?> testConfiguration) throws Exception {
        Path work = Files.createTempDirectory("toggly-mvc-");
        var tomcat = new Tomcat(); tomcat.setBaseDir(work.toString()); tomcat.setPort(port);
        tomcat.getConnector().setProperty("address", "127.0.0.1");
        tomcat.getConnector().setProperty("maxThreads", "8");
        var context = tomcat.addContext("", work.toString());
        if (observer != null) addFilter(context, "test-observer", observer);
        addFilter(context, "response-headers", (request, response, chain) -> {
            var res = (HttpServletResponse) response;
            res.setHeader("Cache-Control", "no-store"); res.setHeader("X-Content-Type-Options", "nosniff");
            res.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'self'; form-action 'self'; frame-ancestors 'none'");
            chain.doFilter(request, response);
        });
        var spring = new AnnotationConfigWebApplicationContext();
        spring.addBeanFactoryPostProcessor(factory -> factory.registerSingleton("sampleRuntime", runtime));
        spring.register(WebConfig.class);
        if (testConfiguration != null) spring.register(testConfiguration);
        if (runtime.configured()) spring.register(NativeSdkConfig.class);
        var wrapper = Tomcat.addServlet(context, "mvc", new DispatcherServlet(spring));
        wrapper.setLoadOnStartup(1); wrapper.setAsyncSupported(false); // ThreadLocal is synchronous, not async propagation.
        context.addServletMappingDecoded("/", "mvc");
        var app = new Main(tomcat, work, runtime);
        try {
            runtime.start(); tomcat.start();
            if (!context.getState().isAvailable() || !spring.isActive()) throw new IllegalStateException("MVC startup failed");
            return app;
        } catch (Exception error) { app.close(); throw error; }
    }
    private static void addFilter(org.apache.catalina.Context context, String name, Filter filter) {
        var def = new FilterDef(); def.setFilterName(name); def.setFilter(filter); context.addFilterDef(def);
        var mapping = new FilterMap(); mapping.setFilterName(name); mapping.addURLPattern("/*"); context.addFilterMap(mapping);
    }
    public SampleRuntime runtime() { return runtime; }
    public String url() { return "http://127.0.0.1:" + tomcat.getConnector().getLocalPort(); }
    @Override public void close() throws Exception {
        try { tomcat.stop(); } finally {
            try { tomcat.destroy(); } finally {
                runtime.close();
                try (var paths = Files.walk(work)) {
                    for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(path);
                }
            }
        }
    }
}
