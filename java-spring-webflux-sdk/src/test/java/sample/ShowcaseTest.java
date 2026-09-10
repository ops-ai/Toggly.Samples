package sample;

import org.junit.jupiter.api.Test;
import java.net.URI;
import java.net.http.*;
import static org.junit.jupiter.api.Assertions.*;

class ShowcaseTest {
    @Test void missingKeyIsVisibleAndEveryProtectedRouteDenies() throws Exception {
        try (var app = Main.start(0, SampleRuntime.unconfigured()); var http = HttpClient.newHttpClient()) {
            var home = http.send(HttpRequest.newBuilder(URI.create(app.url() + "/")).build(), HttpResponse.BodyHandlers.ofString());
            assertEquals(200, home.statusCode());
            assertTrue(home.body().contains("Missing TOGGLY_APP_KEY"));
            for (String route : new String[]{"/gated/feature", "/gated/negate", "/gated/all", "/gated/any", "/gated/beta", "/gated/unknown", "/native/reactive", "/native/enabled"}) {
                assertEquals(503, http.send(HttpRequest.newBuilder(URI.create(app.url() + route)).build(), HttpResponse.BodyHandlers.ofString()).statusCode(), route);
            }
            for (String route : new String[]{"/actions/submit", "/api/refresh"}) {
                var denied = http.send(HttpRequest.newBuilder(URI.create(app.url() + route))
                        .POST(HttpRequest.BodyPublishers.noBody()).build(), HttpResponse.BodyHandlers.ofString());
                assertEquals(503, denied.statusCode(), route);
            }
        }
    }
}
