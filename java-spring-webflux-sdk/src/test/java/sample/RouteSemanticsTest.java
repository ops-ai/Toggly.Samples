package sample;

import org.junit.jupiter.api.Test;
import java.net.*;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

/** Actual socket requests: native gates must recognize exactly the routes Spring dispatches. */
class RouteSemanticsTest {
    private static List<String> equivalents(String path) {
        if (path.equals("/")) return List.of("/");
        var encoded = new StringBuilder();
        var matrix = new StringBuilder();
        for (String segment : path.substring(1).split("/")) {
            encoded.append('/').append(String.format("%%%02x", (int) segment.charAt(0))).append(segment.substring(1));
            matrix.append('/').append(segment).append(";demo=1");
        }
        return List.of(path, encoded.toString(), matrix.toString());
    }
    private static HttpResponse<String> request(HttpClient http, Main app, String path, String form) throws Exception {
        var builder = HttpRequest.newBuilder(URI.create(app.url() + path)).timeout(Duration.ofSeconds(10));
        if (form != null) builder.header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(form));
        return http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }
    private static void expect(HttpClient http, Main app, String route, String query, String form, int status) throws Exception {
        for (String path : equivalents(route)) {
            var response = request(http, app, path + query, form);
            assertEquals(status, response.statusCode(), path + query + ": " + response.body());
        }
    }
    @Test void signedNativeGatesActionsAndAsyncRoutesMatchSpringEncodedAndMatrixPaths() throws Exception {
        try (var definitions = new DefinitionsServer(); var app = Main.start(0, definitions.lifecycle());
             var http = HttpClient.newHttpClient()) {
            expect(http, app, "/gated/beta", "?preset=nonmatching", null, 404);
            expect(http, app, "/gated/beta", "?preset=matching", null, 200);
            expect(http, app, "/gated/feature", "", null, 200);
            expect(http, app, "/gated/negate", "", null, 404);
            expect(http, app, "/gated/all", "", null, 404);
            expect(http, app, "/gated/any", "", null, 200);
            expect(http, app, "/gated/unknown", "", null, 404);
            expect(http, app, "/actions/submit", "?preset=nonmatching", "", 403);
            expect(http, app, "/actions/submit", "?preset=matching", "", 200);
            for (String path : equivalents("/native/reactive")) {
                var result = request(http, app, path + "?preset=matching", null);
                assertEquals(200, result.statusCode()); assertEquals("alice:true", result.body());
            }
            for (String path : equivalents("/native/enabled")) {
                var result = request(http, app, path + "?preset=matching", null);
                assertEquals(200, result.statusCode()); assertTrue(result.body().contains("filter-targeting"));
            }
            definitions.publish(false);
            expect(http, app, "/api/refresh", "", "", 200);
            expect(http, app, "/gated/feature", "", null, 404);
            expect(http, app, "/gated/negate", "", null, 200);
            expect(http, app, "/gated/any", "", null, 404);
            definitions.envelope = definitions.signed(DefinitionsServer.definitions(true).replace(
                    "\"featureKey\":\"api-v2\",\"filters\":[{\"name\":\"AlwaysOff\"",
                    "\"featureKey\":\"api-v2\",\"filters\":[{\"name\":\"AlwaysOn\""), ++definitions.timestamp);
            expect(http, app, "/api/refresh", "", "", 200);
            expect(http, app, "/gated/all", "", null, 200);
            expect(http, app, "/gated/any", "", null, 200);
        }
    }
    @Test void keylessEquivalentPathsDenyInsteadOfBypassingOrThrowing() throws Exception {
        try (var app = Main.start(0, SampleRuntime.unconfigured()); var http = HttpClient.newHttpClient()) {
            for (String path : List.of("/gated/feature", "/gated/negate", "/gated/all", "/gated/any", "/gated/beta",
                    "/gated/unknown", "/gated/not-a-route", "/native/reactive", "/native/enabled", "/native/not-a-route")) {
                expect(http, app, path, "?preset=matching", null, 503);
            }
            expect(http, app, "/actions/submit", "", "", 503);
            expect(http, app, "/api/refresh", "", "", 503);
        }
    }
    @Test void signedAndKeylessPageModelsUseCanonicalMatchedSection() throws Exception {
        try (var definitions = new DefinitionsServer(); var http = HttpClient.newHttpClient()) {
            for (SampleRuntime runtime : List.of(SampleRuntime.unconfigured(), definitions.lifecycle())) {
                try (var app = Main.start(0, runtime)) {
                    for (int i = 0; i < Catalog.PATHS.size(); i++) {
                        for (String path : equivalents(Catalog.PATHS.get(i))) {
                            var result = request(http, app, path + "?preset=matching", null);
                            assertEquals(200, result.statusCode(), path);
                            assertTrue(result.body().contains("<h1>" + Catalog.TITLES.get(i) + "</h1>"), path);
                            assertEquals(!runtime.configured(), result.body().contains("Missing TOGGLY_APP_KEY"), path);
                            if (Catalog.PATHS.get(i).equals("/filters")) {
                                for (String key : Catalog.FILTERS) assertTrue(result.body().contains("data-flag=\"" + key + "\""), key);
                            }
                        }
                    }
                }
            }
        }
    }
    @Test void encodedAndMatrixContextSaveClearRemainSessionLocalBeforeNativeEvaluation() throws Exception {
        try (var definitions = new DefinitionsServer()) {
            for (SampleRuntime runtime : List.of(SampleRuntime.unconfigured(), definitions.lifecycle())) {
                try (var app = Main.start(0, runtime);
                     var alice = HttpClient.newBuilder().cookieHandler(new CookieManager(null, CookiePolicy.ACCEPT_ALL)).build();
                     var bob = HttpClient.newBuilder().cookieHandler(new CookieManager(null, CookiePolicy.ACCEPT_ALL)).build()) {
                    assertEquals(303, request(bob, app, "/context", "preset=nonmatching").statusCode());
                    for (String path : equivalents("/context")) {
                        assertEquals(303, request(alice, app, path, "preset=matching").statusCode());
                        var result = request(alice, app, "/api/evaluate", null);
                        assertTrue(result.body().contains("\"identity\":\"alice\""), path + result.body());
                        assertTrue(result.body().contains("\"order\":\"ord-vip\""), path);
                        assertTrue(result.body().contains("\"ExpressCheckout\":" + runtime.configured()), path);
                        expect(alice, app, "/gated/beta", "", null, runtime.configured() ? 200 : 503);
                        assertEquals(303, request(alice, app, path, "preset=clear").statusCode());
                        assertTrue(request(alice, app, "/api/evaluate", null).body().contains("\"identity\":\"\""), path);
                        expect(alice, app, "/gated/beta", "", null, runtime.configured() ? 404 : 503);
                        assertTrue(request(bob, app, "/api/evaluate", null).body().contains("\"identity\":\"bob\""));
                    }
                }
            }
        }
    }
    @Test void encodedSeparatorsDoNotBecomeNewRouteSegmentsOrBroadenUnknownPaths() throws Exception {
        try (var definitions = new DefinitionsServer(); var http = HttpClient.newHttpClient()) {
            for (SampleRuntime runtime : List.of(SampleRuntime.unconfigured(), definitions.lifecycle())) {
                try (var app = Main.start(0, runtime)) {
                    for (String path : List.of("/gated%2Fbeta", "/gated%2fbeta", "/actions%2Fsubmit", "/api%2Frefresh",
                            "/native%2Freactive", "/filters%2F", "/filters/", "/filters%3Bx=1", "/context%2F", "/unrelated")) {
                        assertEquals(404, request(http, app, path, null).statusCode(), path);
                    }
                    for (String path : List.of("/gated/%2Fbeta", "/gated/beta%2F", "/gated/beta/", "/gated/not-a-route")) {
                        assertEquals(runtime.configured() ? 404 : 503, request(http, app, path, null).statusCode(), path);
                    }
                    assertEquals(404, request(http, app, "/gated", null).statusCode());
                    assertEquals(404, request(http, app, "/native", null).statusCode());
                }
            }
        }
    }
}
