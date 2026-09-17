package sample;

import io.toggly.core.context.ContextHolder;
import io.toggly.core.context.EvaluationContext;
import io.toggly.core.context.RequestContext;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Sample request isolation. The Boot starter has no context interceptor; FeatureAspect
 * and TogglyClient read ContextHolder, so this filter installs an immutable
 * EvaluationContext and always clears the ThreadLocal.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class DemoContextFilter extends OncePerRequestFilter {
    static final String SESSION_KEY = "demo-persona";

    public record Persona(String identity, String role, String country, String language, String userAgent, boolean vip) {}

    static Persona matching() {
        return new Persona("alice", "admin", "US", "en-US,en;q=0.9", Catalog.MATCHING_UA, true);
    }

    static Persona nonmatching() {
        return new Persona("bob", "user", "CA", "fr-FR,fr;q=0.9", Catalog.NONMATCHING_UA, false);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        ContextHolder.setContext(resolve(request));
        try {
            chain.doFilter(request, response);
        } finally {
            ContextHolder.clear();
        }
    }

    static EvaluationContext resolve(HttpServletRequest req) {
        var session = req.getSession(false);
        Persona saved = session == null ? null : (Persona) session.getAttribute(SESSION_KEY);
        String preset = req.getParameter("preset");
        Persona chosen = "matching".equals(preset) ? matching() : "nonmatching".equals(preset) ? nonmatching() : saved;
        if (chosen == null) {
            chosen = new Persona("", "", value(req.getHeader("cf-ipcountry")),
                    value(req.getHeader("Accept-Language")), value(req.getHeader("User-Agent")), false);
        }
        if ("POST".equals(req.getMethod()) && "/context".equals(req.getRequestURI())) {
            if ("clear".equals(preset)) {
                if (session != null) {
                    session.invalidate();
                }
                chosen = new Persona("", "", "", "", "", false);
            } else {
                // Demo controls are not trusted authentication or authorization.
                chosen = new Persona(
                        field(req, "identity", chosen.identity()),
                        field(req, "role", chosen.role()),
                        field(req, "country", chosen.country()),
                        field(req, "language", chosen.language()),
                        field(req, "userAgent", chosen.userAgent()),
                        "vip".equals(field(req, "order", chosen.vip() ? "vip" : "standard")));
                req.getSession(true).setAttribute(SESSION_KEY, chosen);
            }
        }
        boolean vip = req.getParameter("order") == null ? chosen.vip() : "vip".equals(req.getParameter("order"));
        req.setAttribute("persona", chosen);
        return EvaluationContext.builder()
                .identity(chosen.identity().isBlank() ? null : chosen.identity())
                .claim("role", chosen.role())
                .request(RequestContext.of(chosen.userAgent(), chosen.language(), chosen.country()))
                .entity("missing".equals(req.getParameter("order")) ? null : Catalog.order(vip))
                .build();
    }

    private static String field(HttpServletRequest request, String key, String fallback) {
        String value = request.getParameter(key);
        return value == null ? fallback : value.substring(0, Math.min(value.length(), 512));
    }

    private static String value(String value) {
        return value == null ? "" : value;
    }
}
