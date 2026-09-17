package sample;

import io.toggly.core.TogglyClient;
import io.toggly.core.context.ContextHolder;
import java.util.Map;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ModelAttribute;

/**
 * Sample model advice. The Boot starter has no TogglyModelAttribute; MVC's
 * published advice is a different adapter. This evaluates the current request
 * context after DemoContextFilter installs it.
 */
@ControllerAdvice
public class FeaturesAdvice {
    private final ObjectProvider<TogglyClient> client;

    public FeaturesAdvice(ObjectProvider<TogglyClient> client) {
        this.client = client;
    }

    @ModelAttribute("features")
    public Map<String, Boolean> features() {
        TogglyClient toggly = client.getIfAvailable();
        if (toggly == null) {
            return Map.of();
        }
        return toggly.evaluateAll(ContextHolder.getContext());
    }
}
