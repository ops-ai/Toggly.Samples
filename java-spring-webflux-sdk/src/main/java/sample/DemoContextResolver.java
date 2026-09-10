package sample;

import io.toggly.core.context.EvaluationContext;
import io.toggly.core.context.RequestContext;
import io.toggly.spring.webflux.ReactiveContextResolver;
import org.springframework.util.MultiValueMap;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

/** Resolve session/form inputs asynchronously before the native filter installs Reactor context. */
public final class DemoContextResolver implements ReactiveContextResolver {
    static final String SESSION_KEY = "demo-persona";
    public record Persona(String identity, String role, String country, String language, String userAgent, boolean vip) {}
    static Persona matching() { return new Persona("alice", "admin", "US", "en-US,en;q=0.9", Catalog.MATCHING_UA, true); }
    static Persona nonmatching() { return new Persona("bob", "user", "CA", "fr-FR,fr;q=0.9", Catalog.NONMATCHING_UA, false); }
    @Override public Mono<EvaluationContext> resolve(ServerWebExchange exchange) {
        return exchange.getSession().flatMap(session -> exchange.getFormData().map(form -> {
            var request = exchange.getRequest(); var query = request.getQueryParams();
            boolean saving = request.getMethod().name().equals("POST") && request.getPath().value().equals("/context");
            var inputs = saving ? form : query;
            String preset = inputs.getFirst("preset");
            Persona saved = session.getAttribute(SESSION_KEY);
            Persona chosen = "matching".equals(preset) ? matching() : "nonmatching".equals(preset) ? nonmatching() : saved;
            if (chosen == null) chosen = new Persona("", "", value(request.getHeaders().getFirst("cf-ipcountry")),
                    value(request.getHeaders().getFirst("Accept-Language")), value(request.getHeaders().getFirst("User-Agent")), false);
            if (saving) {
                if ("clear".equals(preset)) {
                    session.getAttributes().remove(SESSION_KEY);
                    chosen = new Persona("", "", "", "", "", false);
                } else {
                    // Demonstration controls only. Real apps derive identity/claims from trusted authentication.
                    chosen = new Persona(field(form,"identity",chosen.identity()),field(form,"role",chosen.role()),
                            field(form,"country",chosen.country()),field(form,"language",chosen.language()),
                            field(form,"userAgent",chosen.userAgent()),"vip".equals(field(form,"order",chosen.vip()?"vip":"standard")));
                    session.getAttributes().put(SESSION_KEY, chosen);
                }
            }
            boolean vip = query.getFirst("order") == null ? chosen.vip() : "vip".equals(query.getFirst("order"));
            return EvaluationContext.builder().identity(chosen.identity().isBlank() ? null : chosen.identity())
                    .claim("role",chosen.role()).request(RequestContext.of(chosen.userAgent(),chosen.language(),chosen.country()))
                    .entity("missing".equals(query.getFirst("order")) ? null : Catalog.order(vip)).build();
        }));
    }
    private static String field(MultiValueMap<String,String> values, String key, String fallback) {
        String text = values.getFirst(key); return text == null ? fallback : text.substring(0,Math.min(text.length(),512));
    }
    private static String value(String text) { return text == null ? "" : text; }
}
