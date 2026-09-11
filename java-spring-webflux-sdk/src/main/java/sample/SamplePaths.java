package sample;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.util.pattern.PathPattern;
import org.springframework.web.util.pattern.PathPatternParser;
import java.util.Map;
import java.util.function.Predicate;
import java.util.stream.Collectors;

/** Use the same parsed segment semantics as Spring's controller mappings at every route boundary. */
final class SamplePaths {
    private SamplePaths() {}

    static final Predicate<ServerWebExchange> CONTEXT = matching("/context");
    static final Predicate<ServerWebExchange> PROTECTED = descendantsOf("/gated")
            .or(descendantsOf("/native"))
            .or(matching("/actions/submit"))
            .or(matching("/api/refresh"));
    private static final Map<String, PathPattern> PAGES = Catalog.PATHS.stream()
            .collect(Collectors.toUnmodifiableMap(path -> path, SamplePaths::compile));

    static Predicate<ServerWebExchange> matching(String pattern) {
        // Compile at configuration time. Spring decodes each segment and ignores its matrix parameters;
        // it does not turn an encoded slash inside a segment into a new path separator.
        PathPattern parsed = compile(pattern);
        return exchange -> parsed.matches(exchange.getRequest().getPath().pathWithinApplication());
    }
    private static Predicate<ServerWebExchange> descendantsOf(String namespace) {
        // Preserve the setup guard's namespace behavior: /gated/anything is protected, /gated is unknown.
        return matching(namespace + "/**").and(matching(namespace).negate());
    }
    static String page(ServerWebExchange exchange) {
        var path = exchange.getRequest().getPath().pathWithinApplication();
        // View switches need a canonical catalog key even when the accepted request used %xx or ;params.
        return PAGES.entrySet().stream().filter(entry -> entry.getValue().matches(path))
                .map(Map.Entry::getKey).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }
    private static PathPattern compile(String pattern) {
        return PathPatternParser.defaultInstance.parse(pattern);
    }
}
