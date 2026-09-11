package sample;

import io.toggly.core.TogglyClient;
import io.toggly.core.context.ContextHolder;
import io.toggly.core.context.EvaluationContext;
import io.toggly.core.model.FeatureRequirement;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.List;
import java.util.Set;

/** Application behavior uses explicit immutable request context, never a shared identity setter. */
public final class ShowcaseServlet extends HttpServlet {
    private final SampleLifecycle lifecycle;
    private static final Set<String> PAGES = Set.of("/", "/gates", "/programmatic", "/identity", "/orders", "/filters", "/servlet", "/configuration");
    ShowcaseServlet(SampleLifecycle lifecycle) { this.lifecycle = lifecycle; }
    @Override protected void doGet(HttpServletRequest req, HttpServletResponse res) throws IOException {
        String path = req.getRequestURI();
        if ("/style.css".equals(path) || "/workshop.js".equals(path)) {
            res.setContentType(path.endsWith(".css") ? "text/css" : "text/javascript");
            try (var asset = getClass().getResourceAsStream(path)) { asset.transferTo(res.getOutputStream()); }
            return;
        }
        var client = SampleLifecycle.client(getServletContext());
        var context = ContextHolder.getContext();
        if ("/api/evaluate".equals(path)) {
            res.setContentType("application/json"); res.setCharacterEncoding("UTF-8");
            res.getWriter().write(snapshot(client, context)); return;
        }
        if (Set.of("/gated/feature", "/gated/negate", "/gated/all", "/gated/any", "/gated/beta").contains(path)) {
            res.setContentType("text/html;charset=UTF-8");
            res.getWriter().write(Views.page("Native gate allowed", "<p>The published FeatureGateFilter allowed this request before the servlet ran.</p><pre>" + Views.escape(snapshot(client, context)) + "</pre>", client, context, lifecycle));
            return;
        }
        if (!PAGES.contains(path)) { res.sendError(404); return; }
        res.setContentType("text/html;charset=UTF-8");
        res.getWriter().write(Views.render(path, client, context, lifecycle));
    }
    @Override protected void doPost(HttpServletRequest req, HttpServletResponse res) throws IOException {
        String path = req.getRequestURI();
        if ("/context".equals(path)) {
            // The preceding context filter has already applied the immutable demo persona.
            res.setStatus(303); res.setHeader("Location", "/identity"); return;
        }
        if ("/actions/submit".equals(path)) {
            var client = SampleLifecycle.client(getServletContext());
            boolean enabled = enabled(client, "enhanced-submit", ContextHolder.getContext());
            res.setStatus(client == null ? 503 : enabled ? 200 : 403);
            res.setContentType("text/plain;charset=UTF-8");
            res.getWriter().write(enabled ? "Enhanced submit allowed (demonstration only; no order persisted)" : "Enhanced submit denied"); return;
        }
        res.sendError(404);
    }
    static boolean enabled(TogglyClient c, String key, EvaluationContext context) { return c != null && c.isEnabled(key, context); }
    static boolean gate(TogglyClient c, boolean any, boolean negate, EvaluationContext context) {
        return c != null && c.gate(List.of("new-dashboard", "api-v2"), any ? FeatureRequirement.ANY : FeatureRequirement.ALL, negate, context);
    }
    static String snapshot(TogglyClient c, EvaluationContext context) {
        var json = new StringBuilder("{\"identity\":\"").append(json(context.getIdentity())).append("\",\"order\":\"")
                .append(json(context.getEntity().getKey())).append("\",\"configured\":").append(c != null).append(",\"flags\":{");
        for (int i = 0; i < Catalog.FLAGS.size(); i++) {
            String key = Catalog.FLAGS.get(i);
            if (i > 0) json.append(',');
            json.append('"').append(key).append("\":").append(enabled(c, key, context));
        }
        return json.append("}}").toString();
    }
    private static String json(String value) {
        if (value == null) return "";
        StringBuilder result = new StringBuilder();
        for (char c : value.toCharArray()) {
            if (c == '"' || c == '\\') result.append('\\').append(c);
            else if (c < 32) result.append(String.format("\\u%04x", (int) c));
            else result.append(c);
        }
        return result.toString();
    }
}
