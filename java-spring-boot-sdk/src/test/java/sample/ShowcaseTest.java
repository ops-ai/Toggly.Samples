package sample;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ShowcaseTest {
    @Test
    void missingKeyIsVisibleAndEveryProtectedRouteDenies() throws Exception {
        try (var app = Application.start(0, Map.of("toggly.enabled", false))) {
            var http = HttpClient.newHttpClient();
            var home = http.send(HttpRequest.newBuilder(URI.create(app.url() + "/")).build(),
                    HttpResponse.BodyHandlers.ofString());
            assertEquals(200, home.statusCode());
            assertTrue(home.body().contains("Missing TOGGLY_APP_KEY"));
            for (String route : new String[]{
                    "/gated/feature", "/gated/negate", "/gated/all", "/gated/any", "/gated/beta", "/native/argument"}) {
                assertEquals(503, http.send(HttpRequest.newBuilder(URI.create(app.url() + route)).build(),
                        HttpResponse.BodyHandlers.ofString()).statusCode(), route);
            }
            for (String route : new String[]{"/actions/submit", "/api/refresh"}) {
                var denied = http.send(HttpRequest.newBuilder(URI.create(app.url() + route))
                        .POST(HttpRequest.BodyPublishers.noBody()).build(), HttpResponse.BodyHandlers.ofString());
                assertEquals(503, denied.statusCode(), route);
            }
        }
    }
}
