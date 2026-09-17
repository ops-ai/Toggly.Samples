package sample;

import io.toggly.core.TogglyClient;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Sample 503 for protected examples when starter auto-configuration did not create a client. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class UnconfiguredGuardFilter extends OncePerRequestFilter {
    private final ObjectProvider<TogglyClient> client;

    public UnconfiguredGuardFilter(ObjectProvider<TogglyClient> client) {
        this.client = client;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = request.getRequestURI();
        if (client.getIfAvailable() == null && protectedPath(path)) {
            response.setStatus(503);
            response.setContentType(MediaType.TEXT_PLAIN_VALUE + ";charset=UTF-8");
            response.getWriter().write("Missing TOGGLY_APP_KEY: protected example unavailable");
            return;
        }
        chain.doFilter(request, response);
    }

    private static boolean protectedPath(String path) {
        return path.startsWith("/gated/") || path.startsWith("/native/")
                || path.equals("/actions/submit") || path.equals("/api/refresh");
    }
}
