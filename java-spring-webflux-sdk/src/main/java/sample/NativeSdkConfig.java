package sample;

import io.toggly.spring.webflux.*;
import org.springframework.context.annotation.*;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;

/** Registers the actual published adapter filters and client in the production Spring host. */
@Configuration
public class NativeSdkConfig {
    private final SampleRuntime runtime;
    public NativeSdkConfig(SampleRuntime runtime) { this.runtime = runtime; }
    @Bean(destroyMethod="") public ReactiveTogglyClient reactiveTogglyClient() {
        // This wrapper's close delegates to core.close. Runtime alone owns that client; avoid double close.
        return new ReactiveTogglyClient(runtime.client());
    }
    @Bean @Order(0) public FeatureGateFilter feature() { return gate("/gated/feature","new-dashboard").build(); }
    @Bean @Order(0) public FeatureGateFilter negate() { return gate("/gated/negate","new-dashboard").negate().build(); }
    @Bean @Order(0) public FeatureGateFilter all() { return gate("/gated/all","new-dashboard","api-v2").matchAll().build(); }
    @Bean @Order(0) public FeatureGateFilter any() { return gate("/gated/any","new-dashboard","api-v2").matchAny().build(); }
    @Bean @Order(0) public FeatureGateFilter beta() { return gate("/gated/beta","beta-access").build(); }
    @Bean @Order(0) public FeatureGateFilter unknown() { return gate("/gated/unknown","unknown").build(); }
    @Bean @Order(0) public FeatureGateFilter submit() { return gate("/actions/submit","enhanced-submit").blockedStatus(HttpStatus.FORBIDDEN).build(); }
    private FeatureGateFilter.Builder gate(String path,String... flags) {
        // Native pathPattern compares raw text. The supported matcher extension aligns this native
        // gate with Spring's decoded segments/matrix parameters; evaluation stays entirely native.
        return FeatureGateFilter.builder(runtime.client()).features(flags).pathMatcher(SamplePaths.matching(path));
    }
}
