package sample;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

/** Test transport only. The real SDK parses, verifies signatures and evaluates every filter. */
final class DefinitionsServer implements AutoCloseable {
    final HttpServer server;
    final KeyPair key;
    final String kid;
    final String jwks;
    final AtomicInteger fetches = new AtomicInteger();
    volatile String envelope;
    volatile int status = 200;
    long timestamp = 1_800_000_000L;
    DefinitionsServer() throws Exception {
        var generator = KeyPairGenerator.getInstance("EC"); generator.initialize(new ECGenParameterSpec("secp256r1"));
        key = generator.generateKeyPair();
        var publicKey = (ECPublicKey) key.getPublic();
        byte[] x = coordinate(publicKey.getW().getAffineX().toByteArray());
        byte[] y = coordinate(publicKey.getW().getAffineY().toByteArray());
        var digest = MessageDigest.getInstance("SHA-1"); digest.update(x); digest.update(y);
        kid = HexFormat.of().withUpperCase().formatHex(digest.digest()) + "ES256";
        var base64 = Base64.getUrlEncoder().withoutPadding();
        jwks = "{\"keys\":[{\"kty\":\"EC\",\"crv\":\"P-256\",\"alg\":\"ES256\",\"use\":\"sig\",\"kid\":\"" + kid + "\",\"x\":\"" + base64.encodeToString(x) + "\",\"y\":\"" + base64.encodeToString(y) + "\"}]}";
        publish(true);
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            boolean isJwks = exchange.getRequestURI().getPath().equals("/.well-known/jwks");
            int code = isJwks ? 200 : status;
            if (!isJwks) fetches.incrementAndGet();
            byte[] body = (isJwks ? jwks : envelope).getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(code, body.length);
            try (var output = exchange.getResponseBody()) { output.write(body); }
        });
        server.start();
    }
    SampleRuntime lifecycle() { return new SampleRuntime("offline-test-placeholder", "Production", url(), 0); }
    String url() { return "http://127.0.0.1:" + server.getAddress().getPort(); }
    void publish(boolean dashboard) throws Exception { envelope = signed(definitions(dashboard), ++timestamp); }
    String signed(String defs, long ts) throws Exception {
        var sha = MessageDigest.getInstance("SHA-256");
        byte[] hash = sha.digest(sha.digest((defs + "|" + ts).getBytes(StandardCharsets.UTF_8)));
        var signer = Signature.getInstance("NONEwithECDSA"); signer.initSign(key.getPrivate()); signer.update(hash);
        return "{\"defs\":" + defs + ",\"timestamp\":" + ts + ",\"kid\":\"" + kid + "\",\"signature\":\"" + Base64.getEncoder().encodeToString(signer.sign()) + "\"}";
    }
    static String definitions(boolean dashboard) {
        List<String> definitions = new ArrayList<>();
        definitions.add(flag("new-dashboard", dashboard ? "AlwaysOn" : "AlwaysOff", ""));
        definitions.add(flag("api-v2", "AlwaysOff", ""));
        definitions.add(flag("enhanced-submit", "Targeting", "\"users\":\"alice\""));
        definitions.add(entity("ExpressCheckout"));
        definitions.add(flag("beta-access", "Targeting", "\"users\":\"alice\""));
        definitions.add(flag("filter-always-on", "AlwaysOn", ""));
        definitions.add(flag("filter-percentage", "Percentage", "\"Value\":50"));
        definitions.add(flag("filter-targeting", "Targeting", "\"users\":\"alice\""));
        definitions.add(flag("filter-user-claims", "UserClaims", "\"Claim\":\"role\",\"Value\":\"admin\""));
        definitions.add(flag("filter-time-window", "TimeWindow", "\"Start\":\"2020-01-01T00:00:00Z\",\"End\":\"2099-12-31T23:59:59Z\""));
        definitions.add(flag("filter-country", "Country", "\"Country:0\":\"US\""));
        definitions.add(flag("filter-browser-family", "BrowserFamily", "\"BrowserFamily:0\":\"Chrome\""));
        definitions.add(flag("filter-browser-language", "BrowserLanguage", "\"BrowserLanguage:0\":\"en\""));
        definitions.add(flag("filter-device-type", "DeviceType", "\"DeviceType:0\":\"Macintosh\""));
        definitions.add(flag("filter-os", "OperatingSystem", "\"OperatingSystem:0\":\"Mac\""));
        definitions.add(entity("filter-context-property"));
        return "[" + String.join(",", definitions) + "]";
    }
    private static String flag(String key, String name, String params) {
        // Segment filters require their own rollout Percentage. Missing it intentionally fails closed.
        if (Set.of("UserClaims", "Country", "BrowserFamily", "BrowserLanguage", "DeviceType", "OperatingSystem").contains(name)) {
            params = "\"Percentage\":100," + params;
        }
        return "{\"featureKey\":\"" + key + "\",\"filters\":[{\"name\":\"" + name + "\",\"parameters\":{" + params + "}}]}";
    }
    private static String entity(String key) {
        return "{\"featureKey\":\"" + key + "\",\"contextKind\":\"Order\",\"filters\":[{\"name\":\"ContextProperty\",\"parameters\":{\"Property\":\"Vip\",\"Operator\":\"eq\",\"Value\":\"true\",\"ValueType\":\"boolean\"}}]}";
    }
    private static byte[] coordinate(byte[] bytes) {
        byte[] padded = new byte[32];
        int length = Math.min(bytes.length, 32);
        System.arraycopy(bytes, bytes.length - length, padded, 32 - length, length);
        return padded;
    }
    @Override public void close() { server.stop(0); }
}
