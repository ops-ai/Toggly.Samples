package sample;

import io.toggly.core.context.EvaluationContext;
import io.toggly.core.context.RequestContext;
import io.toggly.servlet.TogglyContextFilter;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.http.HttpServletRequest;

/** Extend native context extraction, retaining its try/finally ContextHolder cleanup. */
public final class DemoContextFilter extends TogglyContextFilter {
    static final String SESSION_KEY = "demo-persona";
    public record Persona(String identity, String role, String country, String language, String userAgent, boolean vip) {}
    static Persona matching() { return new Persona("alice", "admin", "US", "en-US,en;q=0.9", Catalog.MATCHING_UA, true); }
    static Persona nonmatching() { return new Persona("bob", "user", "CA", "fr-FR,fr;q=0.9", Catalog.NONMATCHING_UA, false); }

    @Override protected EvaluationContext createContext(ServletRequest request) {
        HttpServletRequest req = (HttpServletRequest) request;
        var session = req.getSession(false);
        Persona saved = session == null ? null : (Persona) session.getAttribute(SESSION_KEY);
        String preset = req.getParameter("preset");
        Persona chosen = "matching".equals(preset) ? matching() : "nonmatching".equals(preset) ? nonmatching() : saved;
        if (chosen == null) chosen = new Persona("", "", value(req.getHeader("cf-ipcountry")), value(req.getHeader("Accept-Language")), value(req.getHeader("User-Agent")), false);
        if ("POST".equals(req.getMethod()) && "/context".equals(req.getRequestURI())) {
            if ("clear".equals(preset)) {
                if (session != null) session.invalidate();
                chosen = new Persona("", "", "", "", "", false);
            } else {
                // These are explicitly demo controls, not trusted authentication/claims.
                chosen = new Persona(field(req, "identity", chosen.identity()), field(req, "role", chosen.role()),
                        field(req, "country", chosen.country()), field(req, "language", chosen.language()),
                        field(req, "userAgent", chosen.userAgent()), "vip".equals(field(req, "order", chosen.vip() ? "vip" : "standard")));
                req.getSession(true).setAttribute(SESSION_KEY, chosen);
            }
        }
        // Query overrides are request-local and useful for comparing entities without changing the session.
        boolean vip = req.getParameter("order") == null ? chosen.vip() : "vip".equals(req.getParameter("order"));
        req.setAttribute("persona", chosen);
        return EvaluationContext.builder().identity(chosen.identity().isBlank() ? null : chosen.identity())
                .claim("role", chosen.role()).request(RequestContext.of(chosen.userAgent(), chosen.language(), chosen.country()))
                .entity(Catalog.order(vip)).build();
    }
    private static String field(HttpServletRequest r, String key, String fallback) {
        String value = r.getParameter(key);
        return value == null ? fallback : value.substring(0, Math.min(value.length(), 512));
    }
    private static String value(String value) { return value == null ? "" : value; }
}
