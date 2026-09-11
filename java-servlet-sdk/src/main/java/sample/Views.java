package sample;

import io.toggly.core.TogglyClient;
import io.toggly.core.context.EvaluationContext;
import java.util.List;

/** Plain server-rendered HTML is sample composition; the SDK owns every evaluation. */
final class Views {
    private Views() {}
    static final List<String> PATHS = List.of("/", "/gates", "/programmatic", "/identity", "/orders", "/filters", "/servlet", "/configuration");
    static final List<String> TITLES = List.of("Home", "Declarative gates", "Programmatic API", "Identity", "Entity context", "Filters matrix", "Servlet integration", "Configuration");
    static String render(String path, TogglyClient c, EvaluationContext ctx, SampleLifecycle life) {
        String body = switch (path) {
            case "/gates" -> gates(c, ctx);
            case "/programmatic" -> programmatic(c, ctx);
            case "/identity" -> identity(ctx);
            case "/orders" -> orders(c, ctx);
            case "/filters" -> filters(c, ctx);
            case "/servlet" -> servlet();
            case "/configuration" -> configuration();
            default -> home(c, ctx);
        };
        return page(TITLES.get(PATHS.indexOf(path)), body, c, ctx, life);
    }
    static String page(String title, String body, TogglyClient c, EvaluationContext ctx, SampleLifecycle life) {
        StringBuilder nav = new StringBuilder();
        for (int i = 0; i < PATHS.size(); i++) nav.append("<a href=\"").append(PATHS.get(i)).append("\">").append(TITLES.get(i)).append("</a>");
        String status = c == null ? "<aside class=\"warning\" role=\"status\"><strong>Missing TOGGLY_APP_KEY — unconfigured offline mode.</strong> No live evaluations or synthetic enabled flags. Protected examples deny with 503. <a href=\"/configuration\">Set up your app</a>.</aside>"
                : "<aside class=\"status\">Signed definitions configured · " + c.getFeatureKeys().size() + " current definitions · HTTP poll every 60 seconds in normal startup. Reload to see current evaluations.</aside>";
        if (c != null && c.getFeatureKeys().isEmpty()) status += "<aside class=\"warning\">No definitions available yet. Missing flags use false defaults; check your key, environment and connection.</aside>";
        if (life.errors.get() > 0) status += "<aside class=\"warning\">SDK refresh errors observed: " + life.errors.get() + ". The SDK retains its last valid signed definitions. This cumulative warning remains after recovery; inspect current flags and retry refresh.</aside>";
        return "<!doctype html><html lang=\"en\"><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>" + escape(title) + " · Java Servlet SDK Sample</title><link rel=\"stylesheet\" href=\"/style.css\"><script src=\"/workshop.js\" defer></script></head><body><header><p class=\"eyebrow\">TOGGLY / JAVA SERVLET</p><a class=\"brand\" href=\"/\">Feature flag workshop</a><p>Learn the native Servlet pipeline, one request at a time.</p></header><nav aria-label=\"Sections\">" + nav + "</nav><main>" + status + "<p class=\"context\">User: <strong>" + escape(ctx.getIdentity() == null ? "anonymous" : ctx.getIdentity()) + "</strong> · Order: <strong>" + escape(ctx.getEntity().getKey()) + "</strong> · Demo identities are not authentication.</p><h1>" + escape(title) + "</h1>" + body + "</main><footer>Published io.toggly 1.5.1 · Tomcat 11 / Servlet 6.1 · Java 26</footer></body></html>";
    }
    private static String home(TogglyClient c, EvaluationContext ctx) {
        var map = new StringBuilder("<p>Follow the sections from a Boolean flag to isolated users, Orders and native URL gates.</p><div class=\"cards\">");
        for (int i = 1; i < PATHS.size(); i++) map.append("<a class=\"card\" href=\"").append(PATHS.get(i)).append("\"><span>").append(i).append("</span><h2>").append(TITLES.get(i)).append("</h2></a>");
        return map.append("</div><h2>First flag exercise</h2><ol><li>Complete Configuration and create <code>new-dashboard</code> in Production.</li><li>Enable it, wait up to 60 seconds or use native refresh.</li><li>Open Declarative gates: the feature route allows and the negate route denies.</li><li>Disable the flag, refresh, and observe the opposite behavior.</li></ol><h2>Flag checklist and current snapshot</h2><p>Each row is evaluated for this request. Absent means the key is missing from current definitions, not simply OFF.</p>").append(table(c, ctx, Catalog.FLAGS)).append("<p><a href=\"/api/evaluate\">Programmatic JSON snapshot</a> · <a href=\"/api/features\">Native TogglyServlet JSON</a></p>").toString();
    }
    private static String gates(TogglyClient c, EvaluationContext ctx) {
        boolean feature = ShowcaseServlet.enabled(c, "new-dashboard", ctx);
        return "<p>Native <code>FeatureGateFilter</code> declarations in Main.java run before the route. A denied configured gate returns 404.</p><div class=\"cards\">"
                + card("Feature", feature, "/gated/feature") + card("Negate", c != null && !feature, "/gated/negate")
                + card("ALL: dashboard + API v2", ShowcaseServlet.gate(c, false, false, ctx), "/gated/all")
                + card("ANY: dashboard + API v2", ShowcaseServlet.gate(c, true, false, ctx), "/gated/any")
                + "</div><h2>Conditional HTML</h2><p>" + (feature ? "New dashboard content is visible." : "Classic dashboard fallback is visible.")
                + "</p><p>This HTML branch is sample composition around <code>client.isEnabled(key, context)</code>; there is no Servlet SDK template-tag API.</p><h2>Variants</h2><aside class=\"note\">Native variant allocation is unsupported in io.toggly core/servlet 1.5.1. No variant is fabricated. <code>getValue</code> selects between two caller-provided values using a Boolean flag; telemetry variant labels do not allocate experiments.</aside>";
    }
    private static String programmatic(TogglyClient c, EvaluationContext ctx) {
        // Explicit context is the safest form when code may later move outside a Servlet worker.
        boolean enabled = ShowcaseServlet.enabled(c, "api-v2", ctx);
        return "<p>Call <code>isEnabled(\"api-v2\", context)</code> when the branch needs a return value. The same immutable context is passed into <code>gate</code> and <code>evaluateAll</code>.</p><pre>client.isEnabled(\"api-v2\", ContextHolder.getContext())\nclient.gate(List.of(\"new-dashboard\", \"api-v2\"),\n    FeatureRequirement.ALL, false, context)\nclient.evaluateAll(context)</pre><p>Current API version: <strong>" + (enabled ? "v2" : "v1") + "</strong></p><p>Native <code>getValue(\"api-v2\", \"v2\", \"v1\")</code> uses ContextHolder on this synchronous worker: <strong>" + (c == null ? "unavailable" : c.getValue("api-v2", "v2", "v1")) + "</strong>.</p><form method=\"post\" action=\"/actions/submit\"><button>Try enhanced submit</button></form><p>The action evaluates <code>enhanced-submit</code> before proceeding; denial is 403 (503 when unconfigured). It does not save an order.</p><h2>Current request JSON</h2><pre>" + escape(ShowcaseServlet.snapshot(c, ctx)) + "</pre><a href=\"/api/evaluate\">Open JSON endpoint</a>";
    }
    private static String identity(EvaluationContext ctx) {
        return "<p>A session stores demo inputs, not evaluated flag results. <code>DemoContextFilter.createContext</code> reconstructs context before the first gate. Alice and Bob can use separate browser sessions concurrently.</p>" + presets()
                + "<h2>Customize this session</h2><form class=\"fields\" method=\"post\" action=\"/context\">"
                + input("Identity", "identity", ctx.getIdentity()) + input("Claim role", "role", ctx.getClaims().get("role"))
                + input("Country", "country", ctx.getRequest().getCountry()) + input("Accept-Language", "language", ctx.getRequest().getAcceptLanguage())
                + input("User-Agent", "userAgent", ctx.getRequest().getUserAgent())
                + "<label>Order<select name=\"order\"><option value=\"vip\"" + (ctx.getEntity().getKey().equals("ord-vip") ? " selected" : "") + ">ord-vip</option><option value=\"standard\"" + (ctx.getEntity().getKey().equals("ord-standard") ? " selected" : "") + ">ord-standard</option></select></label><button>Apply session context</button></form><form method=\"post\" action=\"/context\"><button name=\"preset\" value=\"clear\">Clear session identity</button></form><p>Initial anonymous requests use actual User-Agent, Accept-Language and cf-ipcountry headers where present. Demo presets intentionally override these values. In production derive identity and claims from trusted authentication, and country from your trusted proxy.</p>";
    }
    private static String orders(TogglyClient c, EvaluationContext ctx) {
        return "<p>User identity stays the same while the entity changes. These checks run side by side in one request, using <code>context.withEntity(...)</code>. Both include kind Order, Id, Vip and Total.</p><div class=\"cards\">"
                + card("ord-vip · Vip=true", ShowcaseServlet.enabled(c, "ExpressCheckout", ctx.withEntity(Catalog.order(true))), "/orders?order=vip")
                + card("ord-standard · Vip=false", ShowcaseServlet.enabled(c, "ExpressCheckout", ctx.withEntity(Catalog.order(false))), "/orders?order=standard")
                + "</div><p>Without an entity: " + badge(ShowcaseServlet.enabled(c, "ExpressCheckout", ctx.withEntity(null)))
                + "</p><pre>var order = new TogglyEntityContext(\"Order\", \"ord-vip\",\n    Map.of(\"Id\", \"ord-vip\", \"Vip\", true, \"Total\", 250));\nclient.isEnabled(\"ExpressCheckout\", context.withEntity(order));</pre><p>The top context line reflects only this request's selection; these links do not mutate the saved persona. Never reuse a Boolean result across different Orders. The published engine compares attributes without enforcing the definition kind; this app explicitly constructs Order at its boundary.</p>";
    }
    private static String filters(TogglyClient c, EvaluationContext ctx) {
        return "<p>All eleven evaluators use the real installed SDK. Apply a preset to the session, or compare a request-only preset:</p>" + presets()
                + "<p><a href=\"/filters?preset=matching\">Matching for this request</a> · <a href=\"/filters?preset=nonmatching\">Non-matching for this request</a></p>"
                + table(c, ctx, Catalog.FILTERS)
                + "<p>AlwaysOn stays ON for both; TimeWindow stays ON during 2020–2099. Percentage is sticky per identity and flag, so Alice/Bob are not prescribed ON/OFF. The seven other supported segment/context rows should be ON for Matching and OFF for Non-matching. DeviceType Macintosh is a published SDK gap: the parser recognizes iPhone/iPad/iPod but returns Other for desktop Macintosh, so this exact shared rule remains OFF.</p><p>Matching: alice, role=admin, US, Chrome/en, Macintosh device, Mac OS, VIP Order. Non-matching: bob, role=user, CA, Firefox/fr, Windows, standard Order. See Identity for the exact request fields.</p>";
    }
    private static String servlet() {
        return "<h2>Native pipeline</h2><ol><li><code>SampleLifecycle</code> calls native listener initialization; the client is available before filter initialization.</li><li>The explicit missing-key guard denies protected examples.</li><li><code>DemoContextFilter</code> extends native context creation; native <code>doFilter</code> installs ContextHolder and clears it in finally.</li><li><code>FeatureGateFilter</code> checks the route with that context.</li><li>The servlet renders HTML or JSON.</li><li>Native listener destruction closes the client and its owned polling provider.</li></ol><p><a href=\"/gated/beta\">Try native beta-access gate</a> · <a href=\"/api/features\">All native feature states</a> · <a href=\"/api/features/new-dashboard\">Native single flag</a></p><form data-native-refresh method=\"post\" action=\"/api/features/refresh\"><button>Request native definitions refresh</button></form><output id=\"refresh-result\" aria-live=\"polite\"></output><p>The native refresh JSON means an attempt completed. A transport/signature failure can retain the prior snapshot; return Home to inspect definitions and the cumulative error warning.</p><h2>Thread lifetime</h2><p>This sample uses synchronous Servlet requests. Native ContextHolder is thread-local and is cleared on success and error. For executor work use explicit immutable EvaluationContext; do not assume ThreadLocal flows into Servlet async dispatch or arbitrary threads.</p>";
    }
    private static String configuration() {
        return "<h2>Connect your own application</h2><ol><li>Open app.toggly.io and choose workspace <strong>Toggly Samples</strong>.</li><li>Create <strong>Java Servlet SDK Sample</strong>; choose <strong>Java</strong> technology and <strong>Production</strong> environment.</li><li>Add allowed origin <code>http://localhost:8086</code>.</li><li>Add Order with Id string key, Vip boolean and Total optional number.</li><li>Create the sixteen flags and Filters category using the full README recipe.</li><li>Copy .env.example to .env, set the key locally, export it and restart this app.</li></ol><p>Never paste a real key into source control. The missing-key app makes no Toggly requests; it is a setup shell, not synthetic live data.</p><h2>Loading, refresh and errors</h2><p>Startup attempts signed definitions once. The SDK fetches on an empty snapshot, polls every 60 seconds, and retains last valid definitions after network or signature failures. Unknown flags default false. Every page evaluates current definitions for the current request; no feature results are stored in the session.</p><p>Tests run the native HTTP provider against an isolated loopback signed fixture with temporary cryptographic keys. Those test fixtures are not loaded by the runnable app. Live dashboard verification requires your own app setup.</p>";
    }
    private static String presets() { return "<div class=\"presets\"><form method=\"post\" action=\"/context\"><button name=\"preset\" value=\"matching\">Matching preset</button></form><form method=\"post\" action=\"/context\"><button name=\"preset\" value=\"nonmatching\">Non-matching preset</button></form></div>"; }
    private static String input(String label, String name, String value) { return "<label>" + label + "<input name=\"" + name + "\" maxlength=\"512\" value=\"" + escape(value) + "\"></label>"; }
    private static String card(String label, boolean value, String path) { return "<article class=\"card\"><h2>" + escape(label) + "</h2>" + badge(value) + "<p><a href=\"" + path + "\">Try this route</a></p></article>"; }
    private static String badge(boolean enabled) { return "<span class=\"badge " + (enabled ? "on" : "off") + "\">" + (enabled ? "ON" : "OFF") + "</span>"; }
    private static String table(TogglyClient c, EvaluationContext ctx, List<String> keys) {
        StringBuilder out = new StringBuilder("<div class=\"table-wrap\"><table><thead><tr><th>Flag key</th><th>Definition</th><th>This request</th></tr></thead><tbody>");
        for (String key : keys) out.append("<tr><td><code>").append(key).append("</code></td><td>").append(c != null && c.getFeatureDefinition(key) != null ? "Present" : "Absent").append("</td><td>").append(badge(ShowcaseServlet.enabled(c, key, ctx))).append(key.equals("filter-device-type") ? " <small>Macintosh detection unsupported in 1.5.1</small>" : "").append("</td></tr>");
        return out.append("</tbody></table></div>").toString();
    }
    static String escape(String value) { return value == null ? "" : value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&#39;"); }
}
