package sample;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/** Exercise native configured integration against the production Spring Boot JAR. */
public final class PackagedProbe {
    public static void main(String[] args) throws Exception {
        Path jar = Path.of("target/java-spring-boot-sdk.jar").toAbsolutePath();
        if (!jar.toFile().isFile()) {
            throw new AssertionError("Missing production package: " + jar);
        }
        String java = System.getProperty("java.home") + "/bin/java";
        try (var definitions = new DefinitionsServer()) {
            var builder = new ProcessBuilder(java, "-jar", jar.toString());
            builder.directory(Path.of(".").toAbsolutePath().toFile());
            Map<String, String> env = builder.environment();
            env.put("TOGGLY_APP_KEY", "offline-test-placeholder");
            env.put("TOGGLY_ENVIRONMENT", "Production");
            env.put("TOGGLY_BASE_URL", definitions.url());
            env.put("SERVER_PORT", "18090");
            env.put("SERVER_ADDRESS", "127.0.0.1");
            Process process = builder.start();
            try {
                var http = HttpClient.newHttpClient();
                URI base = URI.create("http://127.0.0.1:18090");
                waitUntilReady(http, base, process);
                for (String path : new String[]{
                        "/", "/gates", "/programmatic", "/identity", "/orders", "/filters", "/boot",
                        "/configuration", "/style.css", "/gated/beta?preset=matching",
                        "/api/evaluate?preset=matching", "/actuator/health", "/actuator/toggly"}) {
                    var response = http.send(HttpRequest.newBuilder(base.resolve(path)).timeout(Duration.ofSeconds(10)).build(),
                            HttpResponse.BodyHandlers.ofString());
                    if (response.statusCode() != 200) {
                        throw new AssertionError(path + ": " + response.statusCode());
                    }
                    if (path.startsWith("/api/evaluate") && !response.body().contains("\"filter-targeting\":true")) {
                        throw new AssertionError("native context missing");
                    }
                }
                var denied = http.send(HttpRequest.newBuilder(base.resolve("/gated/beta?preset=nonmatching")).build(),
                        HttpResponse.BodyHandlers.ofString());
                if (denied.statusCode() != 404) {
                    throw new AssertionError("native gate did not deny Bob");
                }
                System.out.println("PACKAGED_NATIVE_OK java=" + System.getProperty("java.version") + " jar=" + jar);
            } finally {
                process.destroy();
                if (!process.waitFor(10, TimeUnit.SECONDS)) {
                    process.destroyForcibly();
                    process.waitFor();
                    throw new AssertionError("Packaged app failed graceful shutdown");
                }
            }
        }
    }

    private static void waitUntilReady(HttpClient http, URI base, Process process) throws Exception {
        for (int attempt = 0; attempt < 100; attempt++) {
            if (!process.isAlive()) {
                throw new AssertionError("Packaged process exited before startup");
            }
            try {
                var response = http.send(HttpRequest.newBuilder(base).timeout(Duration.ofSeconds(1)).build(),
                        HttpResponse.BodyHandlers.discarding());
                if (response.statusCode() == 200) {
                    return;
                }
            } catch (Exception ignored) {
                Thread.sleep(100);
            }
        }
        throw new AssertionError("Packaged process did not start");
    }
}
