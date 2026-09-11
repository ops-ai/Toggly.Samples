package sample;

import java.net.URI;
import java.net.http.*;

/** Exercise native configured integration while application classes load from the production JAR. */
public final class PackagedProbe {
    public static void main(String[] args) throws Exception {
        String source = Main.class.getProtectionDomain().getCodeSource().getLocation().getPath();
        if (!source.endsWith("java-spring-mvc-sdk.jar")) throw new AssertionError("Application must load from packaged JAR: " + source);
        try (var definitions = new DefinitionsServer(); var app = Main.start(8088, definitions.lifecycle()); var http = HttpClient.newHttpClient()) {
            for (String path : new String[]{"/", "/gates", "/programmatic", "/identity", "/orders", "/filters", "/mvc", "/configuration", "/style.css", "/gated/beta?preset=matching", "/api/evaluate?preset=matching"}) {
                var response = http.send(HttpRequest.newBuilder(URI.create(app.url() + path)).build(), HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() != 200) throw new AssertionError(path + ": " + response.statusCode());
                if (path.startsWith("/api/evaluate") && !response.body().contains("\"filter-targeting\":true")) throw new AssertionError("native context missing");
            }
            var denied = http.send(HttpRequest.newBuilder(URI.create(app.url() + "/gated/beta?preset=nonmatching")).build(), HttpResponse.BodyHandlers.ofString());
            if (denied.statusCode() != 404) throw new AssertionError("native gate did not deny Bob");
            System.out.println("PACKAGED_NATIVE_OK java=" + System.getProperty("java.version") + " source=" + source);
            if (args.length > 0 && args[0].equals("--serve")) {
                System.out.println("TEST FIXTURE browser server on http://localhost:8088 (no live Toggly app)");
                Thread.currentThread().join();
            }
        }
    }
}
