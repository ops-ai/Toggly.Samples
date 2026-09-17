package sample;

import io.toggly.core.TogglyClient;
import java.util.HashMap;
import java.util.Map;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.ConfigurableEnvironment;

/**
 * Production Spring Boot host. Starter auto-configuration creates the client
 * only when {@code toggly.enabled=true} (Application.main sets that when a key
 * is present). Tests call {@link #start} with explicit properties.
 */
@SpringBootApplication
public class Application implements AutoCloseable {
    private ConfigurableApplicationContext context;

    public static void main(String[] args) {
        String key = System.getenv("TOGGLY_APP_KEY");
        if (key != null && !key.isBlank()) {
            // Starter @ConditionalOnProperty defaults enabled=true, but this sample
            // keeps it false until a real key exists so missing-key mode makes no
            // Toggly requests and constructs no client.
            System.setProperty("toggly.enabled", "true");
        }
        SpringApplication.run(Application.class, args);
        System.out.println("Java Spring Boot SDK Sample: http://localhost:8090");
    }

    public static Application start(int port, Map<String, Object> properties) {
        return start(port, properties, new Class<?>[0]);
    }

    static Application start(int port, Map<String, Object> properties, Class<?>... extraSources) {
        var application = new SpringApplication(Application.class);
        if (extraSources.length > 0) {
            application.addPrimarySources(java.util.List.of(extraSources));
        }
        Map<String, Object> defaults = new HashMap<>();
        defaults.put("server.port", port);
        defaults.put("server.address", "127.0.0.1");
        defaults.put("server.tomcat.threads.max", 8);
        defaults.put("spring.main.log-startup-info", false);
        defaults.putAll(properties);
        // Command-line args beat application.yml. setDefaultProperties does not.
        String[] args = defaults.entrySet().stream()
                .map(entry -> "--" + entry.getKey() + "=" + entry.getValue())
                .toArray(String[]::new);
        var app = new Application();
        app.context = application.run(args);
        return app;
    }

    public ConfigurableApplicationContext context() {
        return context;
    }

    public TogglyClient client() {
        if (context == null || context.getBeanNamesForType(TogglyClient.class).length == 0) {
            return null;
        }
        return context.getBean(TogglyClient.class);
    }

    public SampleDiagnostics diagnostics() {
        return context.getBean(SampleDiagnostics.class);
    }

    public String url() {
        ConfigurableEnvironment environment = context.getEnvironment();
        Integer port = environment.getProperty("local.server.port", Integer.class);
        return "http://127.0.0.1:" + port;
    }

    @Override
    public void close() {
        if (context != null) {
            context.close();
            context = null;
        }
    }
}
