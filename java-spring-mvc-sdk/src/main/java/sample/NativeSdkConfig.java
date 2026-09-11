package sample;

import io.toggly.spring.mvc.*;
import org.springframework.context.annotation.*;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.*;
import java.util.List;

/** Registered only with a configured real client; offline pages cannot accidentally evaluate a fake client. */
@Configuration
public class NativeSdkConfig implements WebMvcConfigurer {
    private final SampleRuntime runtime;
    public NativeSdkConfig(SampleRuntime runtime) { this.runtime = runtime; }
    @Override public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new FeatureGateInterceptor(runtime.client())).order(2);
    }
    @Override public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        // The annotation is nested: FeatureArgumentResolver.FeatureFlag, Boolean/boolean only.
        resolvers.add(new FeatureArgumentResolver(runtime.client()));
    }
    @Bean public TogglyModelAttribute togglyModelAttribute() {
        // This published @ControllerAdvice computes features with the already-installed request context.
        return new TogglyModelAttribute(runtime.client());
    }
}
