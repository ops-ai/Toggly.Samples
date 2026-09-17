package sample;

import io.toggly.spring.boot.FeatureEnabled;
import org.springframework.stereotype.Service;

/**
 * Native Boot AOP gates. {@link FeatureEnabled} is method interception, not an
 * HTTP status. The aspect reads ContextHolder, so DemoContextFilter must run first.
 * There is no negate attribute; disabled methods return {@code defaultValue}.
 */
@Service
public class FeatureService {

    @FeatureEnabled(value = "new-dashboard", defaultValue = "false")
    public boolean dashboard() {
        return true;
    }

    @FeatureEnabled(value = {"new-dashboard", "api-v2"}, matchAll = true, defaultValue = "false")
    public boolean all() {
        return true;
    }

    @FeatureEnabled(value = {"new-dashboard", "api-v2"}, matchAll = false, defaultValue = "false")
    public boolean any() {
        return true;
    }

    @FeatureEnabled(value = "beta-access", defaultValue = "false")
    public boolean beta() {
        return true;
    }

    @FeatureEnabled(value = "enhanced-submit", defaultValue = "false")
    public boolean submit() {
        return true;
    }

    @FeatureEnabled(value = "filter-targeting", defaultValue = "false")
    public boolean targeting() {
        return true;
    }
}
