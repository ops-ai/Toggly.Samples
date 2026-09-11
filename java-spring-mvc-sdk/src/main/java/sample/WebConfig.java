package sample;

import io.toggly.spring.mvc.TogglyContextInterceptor;
import org.springframework.context.annotation.*;
import org.springframework.web.servlet.*;
import org.springframework.web.servlet.config.annotation.*;
import org.springframework.web.servlet.view.freemarker.*;
import java.util.Properties;

/** Ordinary Spring MVC configuration: there is no Boot starter or source replacement. */
@Configuration
@EnableWebMvc
public class WebConfig implements WebMvcConfigurer {
    private final SampleRuntime runtime;
    public WebConfig(SampleRuntime runtime) { this.runtime = runtime; }
    @Override public void addInterceptors(InterceptorRegistry registry) {
        // Native afterCompletion clears the holder even when a later gate denies or a controller throws.
        registry.addInterceptor(new TogglyContextInterceptor(new DemoContextResolver())).order(0);
        registry.addInterceptor(new HandlerInterceptor() {
            @Override public boolean preHandle(jakarta.servlet.http.HttpServletRequest req,
                    jakarta.servlet.http.HttpServletResponse res, Object handler) throws Exception {
                String path = req.getRequestURI();
                if (!runtime.configured() && (path.startsWith("/gated/") || path.startsWith("/native/")
                        || path.equals("/actions/submit") || path.equals("/api/refresh"))) {
                    res.setStatus(503); res.setContentType("text/plain;charset=UTF-8");
                    res.getWriter().write("Missing TOGGLY_APP_KEY: protected example unavailable"); return false;
                }
                return true;
            }
        }).order(1);
    }
    @Override public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/style.css", "/workshop.js").addResourceLocations("classpath:/static/");
    }
    @Bean public ShowcaseController showcaseController() { return new ShowcaseController(runtime); }
    @Bean public FreeMarkerConfigurer freeMarkerConfigurer() {
        var config = new FreeMarkerConfigurer(); config.setTemplateLoaderPath("classpath:/templates/");
        config.setDefaultEncoding("UTF-8");
        var settings = new Properties(); settings.setProperty("recognize_standard_file_extensions", "true");
        settings.setProperty("template_exception_handler", "rethrow"); config.setFreemarkerSettings(settings);
        return config;
    }
    @Bean public FreeMarkerViewResolver viewResolver() {
        var resolver = new FreeMarkerViewResolver(); resolver.setSuffix(".ftlh");
        resolver.setContentType("text/html;charset=UTF-8"); return resolver;
    }
}
