package sample;

import io.toggly.core.Toggly;
import io.toggly.core.context.ContextHolder;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import java.net.*;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;

class NativeIntegrationTest {
    private static HttpResponse<String> get(HttpClient http, Main app, String path) throws Exception {
        return http.send(HttpRequest.newBuilder(URI.create(app.url() + path)).timeout(Duration.ofSeconds(10)).build(), HttpResponse.BodyHandlers.ofString());
    }
    private static HttpResponse<String> post(HttpClient http, Main app, String path, String data) throws Exception {
        return http.send(HttpRequest.newBuilder(URI.create(app.url() + path)).header("Content-Type", "application/x-www-form-urlencoded").POST(HttpRequest.BodyPublishers.ofString(data)).build(), HttpResponse.BodyHandlers.ofString());
    }
    @Test void signedNativePagesGatesProgrammaticAndElevenFilters() throws Exception {
        try (var defs = new DefinitionsServer(); var app = Main.start(0, defs.lifecycle()); var http = HttpClient.newHttpClient()) {
            for (String path : Views.PATHS) {
                var page = get(http, app, path + "?preset=matching");
                assertEquals(200, page.statusCode(), path); assertTrue(page.body().contains("Java Servlet SDK Sample"));
                assertFalse(page.body().contains("Missing TOGGLY_APP_KEY"));
            }
            assertEquals(200, get(http, app, "/gated/feature").statusCode());
            assertEquals(404, get(http, app, "/gated/negate").statusCode());
            assertEquals(404, get(http, app, "/gated/all").statusCode());
            assertEquals(200, get(http, app, "/gated/any").statusCode());
            assertEquals(200, get(http, app, "/gated/beta?preset=matching").statusCode());
            assertEquals(404, get(http, app, "/gated/beta?preset=nonmatching").statusCode());
            assertEquals(404, get(http, app, "/gated/beta").statusCode());
            assertEquals(404, get(http, app, "/gated/unknown").statusCode());
            assertEquals(200, post(http, app, "/actions/submit?preset=matching", "").statusCode());
            assertEquals(403, post(http, app, "/actions/submit?preset=nonmatching", "").statusCode());
            String matching = get(http, app, "/api/features?preset=matching").body();
            String nonmatching = get(http, app, "/api/features?preset=nonmatching").body();
            assertTrue(matching.contains("\"count\":16"));
            for (String filter : Catalog.FILTERS) {
                if (filter.equals("filter-percentage")) continue;
                boolean supported = !filter.equals("filter-device-type");
                assertTrue(matching.contains('"' + filter + "\":" + supported), filter + " matching: " + matching);
                boolean unchanged = filter.equals("filter-always-on") || filter.equals("filter-time-window");
                assertTrue(nonmatching.contains('"' + filter + "\":" + unchanged), filter + " nonmatching: " + nonmatching);
            }
            assertFalse(Toggly.client().isEnabled("ExpressCheckout", io.toggly.core.context.EvaluationContext.empty()));
            // Published core evaluates entity attributes without enforcing definition.contextKind.
            assertTrue(Toggly.client().isEnabled("ExpressCheckout", io.toggly.core.context.EvaluationContext.empty().withEntity(
                    new io.toggly.core.context.TogglyEntityContext("Unknown", "ord-vip", Map.of("Vip", true)))));
            String first = get(http, app, "/api/features/filter-percentage?preset=matching").body();
            assertEquals(first, get(http, app, "/api/features/filter-percentage?preset=matching").body());
            assertTrue(get(http, app, "/api/features/unknown").body().contains("\"enabled\":false,\"exists\":false"));
            assertTrue(get(http, app, "/api/evaluate?preset=matching").body().contains("\"ExpressCheckout\":true"));
            assertTrue(get(http, app, "/api/evaluate?preset=matching&order=standard").body().contains("\"ExpressCheckout\":false"));
            String orders = get(http, app, "/orders?preset=matching").body();
            assertTrue(orders.contains("ord-vip · Vip=true")); assertTrue(orders.contains("ord-standard · Vip=false"));
            assertTrue(get(http, app, "/gates").body().contains("Native variant allocation is unsupported"));
            defs.envelope = defs.signed(DefinitionsServer.definitions(true).replace(
                    "\"featureKey\":\"api-v2\",\"filters\":[{\"name\":\"AlwaysOff\"",
                    "\"featureKey\":\"api-v2\",\"filters\":[{\"name\":\"AlwaysOn\""), ++defs.timestamp);
            post(http, app, "/api/features/refresh", "");
            assertEquals(200, get(http, app, "/gated/all").statusCode());
        }
        assertFalse(Toggly.isInitialized(), "native listener must shut down its static facade");
    }
    @Test void sessionPersonaIsEstablishedBeforeFirstNativeGateAndEscaped() throws Exception {
        try (var defs = new DefinitionsServer(); var app = Main.start(0, defs.lifecycle());
             var alice = HttpClient.newBuilder().cookieHandler(new CookieManager(null, CookiePolicy.ACCEPT_ALL)).build();
             var bob = HttpClient.newBuilder().cookieHandler(new CookieManager(null, CookiePolicy.ACCEPT_ALL)).build()) {
            assertEquals(303, post(alice, app, "/context", "preset=matching").statusCode());
            assertEquals(303, post(bob, app, "/context", "preset=nonmatching").statusCode());
            assertEquals(200, get(alice, app, "/gated/beta").statusCode());
            assertEquals(404, get(bob, app, "/gated/beta").statusCode());
            assertTrue(get(alice, app, "/api/evaluate").body().contains("\"identity\":\"alice\""));
            post(alice, app, "/context", "identity=%3Cscript%3E%22%26&order=standard");
            String html = get(alice, app, "/identity").body();
            assertFalse(html.contains("<script>")); assertTrue(html.contains("&lt;script&gt;&quot;&amp;"));
            post(alice, app, "/context", "preset=clear");
            assertTrue(get(alice, app, "/api/evaluate").body().contains("\"identity\":\"\""));
            assertEquals(404, get(alice, app, "/gated/beta").statusCode());
            assertTrue(get(bob, app, "/api/evaluate").body().contains("\"identity\":\"bob\""));
        }
    }
    @Test void concurrentNativeRequestAndErrorCleanupOnReusedWorkers() throws Exception {
        AtomicInteger observed = new AtomicInteger();
        AtomicInteger leaks = new AtomicInteger();
        Set<String> threads = ConcurrentHashMap.newKeySet();
        Filter observer = (request, response, chain) -> {
            if (ContextHolder.hasContext()) leaks.incrementAndGet();
            threads.add(Thread.currentThread().getName());
            try { chain.doFilter(request, response); }
            finally { if (ContextHolder.hasContext()) leaks.incrementAndGet(); observed.incrementAndGet(); }
        };
        try (var defs = new DefinitionsServer(); var app = Main.start(0, defs.lifecycle(), observer, (request, response, chain) -> {
                 if (((HttpServletRequest) request).getRequestURI().equals("/test-error")) {
                     assertTrue(ContextHolder.hasContext()); throw new ServletException("intentional downstream failure");
                 }
                 chain.doFilter(request, response);
             }); var http = HttpClient.newHttpClient()) {
            List<CompletableFuture<Void>> calls = new ArrayList<>();
            for (int i = 0; i < 80; i++) {
                boolean match = i % 2 == 0;
                String route = "/api/evaluate?preset=" + (match ? "matching" : "nonmatching");
                calls.add(http.sendAsync(HttpRequest.newBuilder(URI.create(app.url() + route)).build(), HttpResponse.BodyHandlers.ofString()).thenAccept(result -> {
                    assertEquals(200, result.statusCode());
                    assertTrue(result.body().contains("\"identity\":\"" + (match ? "alice" : "bob") + "\""));
                    assertTrue(result.body().contains("\"ExpressCheckout\":" + match));
                    assertTrue(result.body().contains("\"filter-targeting\":" + match));
                }));
                String gated = "/gated/beta?preset=" + (match ? "matching" : "nonmatching");
                calls.add(http.sendAsync(HttpRequest.newBuilder(URI.create(app.url() + gated)).build(), HttpResponse.BodyHandlers.ofString())
                        .thenAccept(result -> assertEquals(match ? 200 : 404, result.statusCode())));
            }
            CompletableFuture.allOf(calls.toArray(CompletableFuture[]::new)).get(20, TimeUnit.SECONDS);
            assertEquals(0, leaks.get()); assertTrue(threads.size() <= 8);
            long cleanupDeadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(2);
            while (observed.get() < 160 && System.nanoTime() < cleanupDeadline) Thread.sleep(10);
            assertEquals(160, observed.get());
            assertEquals(500, get(http, app, "/test-error?preset=matching").statusCode());
            assertTrue(get(http, app, "/api/evaluate").body().contains("\"identity\":\"\""));
            assertEquals(0, leaks.get());
        }
    }
    @Test void signedRefreshTamperFailureLastGoodAndRecovery() throws Exception {
        try (var defs = new DefinitionsServer()) {
            var lifecycle = defs.lifecycle();
            try (var app = Main.start(0, lifecycle); var http = HttpClient.newHttpClient()) {
                assertEquals(200, get(http, app, "/gated/feature").statusCode());
                defs.publish(false);
                assertEquals(200, post(http, app, "/api/features/refresh", "").statusCode());
                assertEquals(404, get(http, app, "/gated/feature").statusCode());
                assertEquals(200, get(http, app, "/gated/negate").statusCode());
                defs.publish(true);
                defs.envelope = defs.envelope.replace("\"name\":\"AlwaysOn\"", "\"name\":\"AlwaysOff\"");
                post(http, app, "/api/features/refresh", "");
                assertTrue(lifecycle.errors.get() > 0, "actual ES256 verification must reject changed defs");
                assertEquals(404, get(http, app, "/gated/feature").statusCode());
                assertTrue(get(http, app, "/").body().contains("SDK refresh errors observed"));
                defs.status = 503;
                post(http, app, "/api/features/refresh", "");
                assertEquals(404, get(http, app, "/gated/feature").statusCode());
                defs.status = 200; defs.publish(true);
                post(http, app, "/api/features/refresh", "");
                assertEquals(200, get(http, app, "/gated/feature").statusCode());
            }
        }
        assertFalse(Toggly.isInitialized());
    }
    @Test void initialInvalidSignatureUsesFalseDefaultsAndVisibleError() throws Exception {
        try (var defs = new DefinitionsServer()) {
            defs.envelope = "{}";
            var lifecycle = defs.lifecycle();
            try (var app = Main.start(0, lifecycle); var http = HttpClient.newHttpClient()) {
                var page = get(http, app, "/");
                assertEquals(200, page.statusCode()); assertTrue(page.body().contains("No definitions available yet"));
                assertTrue(page.body().contains("SDK refresh errors observed"));
                assertEquals(404, get(http, app, "/gated/feature").statusCode());
                assertTrue(lifecycle.errors.get() > 0);
            }
        }
    }
    @Test void backgroundPollingChangesNextRequestAndStopsOnNativeShutdown() throws Exception {
        try (var defs = new DefinitionsServer(); var http = HttpClient.newHttpClient()) {
            var life = new SampleLifecycle("offline-test-placeholder", "Production", defs.url(), 1);
            try (var app = Main.start(0, life)) {
                assertEquals(200, get(http, app, "/gated/feature").statusCode());
                defs.publish(false);
                long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
                while (get(http, app, "/gated/feature").statusCode() == 200 && System.nanoTime() < deadline) {
                    Thread.sleep(50);
                }
                assertEquals(404, get(http, app, "/gated/feature").statusCode());
            }
            int countAfterClose = defs.fetches.get();
            Thread.sleep(1200);
            assertEquals(countAfterClose, defs.fetches.get(), "listener close must stop polling");
            assertFalse(Toggly.isInitialized());
        }
    }

}
