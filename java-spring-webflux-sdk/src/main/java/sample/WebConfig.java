package sample;

import io.toggly.spring.webflux.TogglyContextFilter;
import org.springframework.context.annotation.*;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.web.reactive.config.*;
import org.springframework.web.reactive.result.view.freemarker.*;
import org.springframework.web.server.WebFilter;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;
import java.util.Properties;

@Configuration
@EnableWebFlux
public class WebConfig implements WebFluxConfigurer {
    private final SampleRuntime runtime;
    public WebConfig(SampleRuntime runtime) { this.runtime = runtime; }
    @Bean @Order(-100) public TogglyContextFilter togglyContextFilter() {
        // Spring sorts these actual WebFilter beans. Context must wrap the gates, not follow them.
        return new TogglyContextFilter(new DemoContextResolver());
    }
    @Bean @Order(-90) public WebFilter offloadNativeGate() {
        // Native gate evaluation can synchronously fetch when the snapshot is empty.
        // Defer invocation too: subscribeOn alone cannot move work already performed at assembly.
        return (exchange, chain) -> Mono.defer(() -> chain.filter(exchange)).subscribeOn(Schedulers.boundedElastic());
    }
    @Bean @Order(-80) public WebFilter configurationGuard() {
        return (exchange, chain) -> {
            var headers = exchange.getResponse().getHeaders();
            headers.set("Cache-Control","no-store"); headers.set("X-Content-Type-Options","nosniff");
            headers.set("Content-Security-Policy","default-src 'self'; style-src 'self'; form-action 'self'; frame-ancestors 'none'");
            String path = exchange.getRequest().getPath().value();
            if (!runtime.configured() && (path.startsWith("/gated/") || path.startsWith("/native/")
                    || path.equals("/actions/submit") || path.equals("/api/refresh"))) {
                exchange.getResponse().setStatusCode(HttpStatus.SERVICE_UNAVAILABLE);
                return exchange.getResponse().setComplete();
            }
            return chain.filter(exchange);
        };
    }
    @Override public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/style.css","/workshop.js").addResourceLocations("classpath:/static/");
    }
    @Override public void configureViewResolvers(ViewResolverRegistry registry) { registry.freeMarker().suffix(".ftlh"); }
    @Bean public ShowcaseController showcaseController(org.springframework.beans.factory.ObjectProvider<io.toggly.spring.webflux.ReactiveTogglyClient> client) {
        return new ShowcaseController(runtime, client.getIfAvailable());
    }
    @Bean public FreeMarkerConfigurer freeMarkerConfigurer() {
        var config = new FreeMarkerConfigurer(); config.setTemplateLoaderPath("classpath:/templates/");
        config.setDefaultEncoding("UTF-8");
        var settings = new Properties(); settings.setProperty("recognize_standard_file_extensions","true");
        settings.setProperty("template_exception_handler","rethrow");config.setFreemarkerSettings(settings);return config;
    }
}
