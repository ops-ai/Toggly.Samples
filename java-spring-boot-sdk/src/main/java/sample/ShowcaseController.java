package sample;

import io.toggly.core.TogglyClient;
import io.toggly.core.context.ContextHolder;
import io.toggly.core.context.EvaluationContext;
import io.toggly.core.model.FeatureRequirement;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.ResponseBody;

/** Teaching routes are synchronous. Demo personas are not authentication or authorization. */
@Controller
public class ShowcaseController {
    private final ObjectProvider<TogglyClient> client;
    private final ObjectProvider<FeatureService> features;
    private final ObjectProvider<FeatureBeans.StartupCopy> startupCopy;
    private final SampleDiagnostics diagnostics;

    public ShowcaseController(
            ObjectProvider<TogglyClient> client,
            ObjectProvider<FeatureService> features,
            ObjectProvider<FeatureBeans.StartupCopy> startupCopy,
            SampleDiagnostics diagnostics) {
        this.client = client;
        this.features = features;
        this.startupCopy = startupCopy;
        this.diagnostics = diagnostics;
    }

    @GetMapping({"/", "/gates", "/programmatic", "/identity", "/orders", "/filters", "/boot", "/configuration"})
    public String page(HttpServletRequest request, Model model) {
        return view(request.getRequestURI(), model);
    }

    private String view(String path, Model model) {
        var context = ContextHolder.getContext();
        TogglyClient toggly = client.getIfAvailable();
        model.addAttribute("configured", toggly != null);
        model.addAttribute("definitions", toggly == null ? Set.of() : toggly.getFeatureKeys());
        model.addAttribute("errors", diagnostics.errors.get());
        model.addAttribute("path", path);
        model.addAttribute("paths", Catalog.PATHS);
        model.addAttribute("titles", Catalog.TITLES);
        model.addAttribute("title", path.equals("/allowed")
                ? "Native AOP gate allowed"
                : Catalog.TITLES.get(Catalog.PATHS.indexOf(path)));
        model.addAttribute("flags", Catalog.FLAGS);
        model.addAttribute("filters", Catalog.FILTERS);
        model.addAttribute("identity", Objects.toString(context.getIdentity(), ""));
        model.addAttribute("order", context.getEntity() == null ? "missing" : context.getEntity().getKey());
        model.addAttribute("role", context.getClaims().getOrDefault("role", ""));
        model.addAttribute("country", context.getRequest() == null ? "" : Objects.toString(context.getRequest().getCountry(), ""));
        model.addAttribute("language", context.getRequest() == null ? "" : Objects.toString(context.getRequest().getAcceptLanguage(), ""));
        model.addAttribute("userAgent", context.getRequest() == null ? "" : Objects.toString(context.getRequest().getUserAgent(), ""));
        model.addAttribute("vipOn", enabled("ExpressCheckout", context.withEntity(Catalog.order(true))));
        model.addAttribute("standardOn", enabled("ExpressCheckout", context.withEntity(Catalog.order(false))));
        model.addAttribute("missingOn", enabled("ExpressCheckout", context.withEntity(null)));
        model.addAttribute("apiVersion", toggly == null ? "unavailable" : toggly.getValue("api-v2", "v2", "v1"));
        model.addAttribute("allOn", gate(FeatureRequirement.ALL));
        model.addAttribute("anyOn", gate(FeatureRequirement.ANY));
        Optional<FeatureBeans.StartupCopy> copy = Optional.ofNullable(startupCopy.getIfAvailable());
        model.addAttribute("startupCopy", copy.map(FeatureBeans.StartupCopy::text).orElse("No ConditionalOnFeature bean selected."));
        model.addAttribute("startupDashboard", copy.map(FeatureBeans.StartupCopy::dashboardEnabledAtStartup).orElse(false));
        return "workshop";
    }

    private boolean enabled(String key, EvaluationContext context) {
        TogglyClient toggly = client.getIfAvailable();
        return toggly != null && toggly.isEnabled(key, context);
    }

    private boolean gate(FeatureRequirement requirement) {
        TogglyClient toggly = client.getIfAvailable();
        return toggly != null && toggly.gate(List.of("new-dashboard", "api-v2"), requirement, false, ContextHolder.getContext());
    }

    @PostMapping("/context")
    public ResponseEntity<Void> saveContext() {
        return ResponseEntity.status(303).header("Location", "/identity").build();
    }

    @GetMapping("/gated/feature")
    public Object feature(Model model) {
        return allow(features.getObject().dashboard(), model);
    }

    @GetMapping("/gated/negate")
    public Object negate(Model model) {
        // FeatureEnabled has no negate attribute. This HTTP invert is sample composition.
        return allow(!features.getObject().dashboard(), model);
    }

    @GetMapping("/gated/all")
    public Object all(Model model) {
        return allow(features.getObject().all(), model);
    }

    @GetMapping("/gated/any")
    public Object any(Model model) {
        return allow(features.getObject().any(), model);
    }

    @GetMapping("/gated/beta")
    public Object beta(Model model) {
        return allow(features.getObject().beta(), model);
    }

    @GetMapping("/gated/unknown")
    public Object unknown(Model model) {
        return allow(enabled("unknown", ContextHolder.getContext()), model);
    }

    @PostMapping("/actions/submit")
    @ResponseBody
    public ResponseEntity<String> submit() {
        if (!features.getObject().submit()) {
            return ResponseEntity.status(403).body("Enhanced submit denied");
        }
        return ResponseEntity.ok("Enhanced submit allowed (demonstration only; no order persisted)");
    }

    @GetMapping("/native/argument")
    @ResponseBody
    public String argument() {
        // Starter has no FeatureFlag argument resolver. FeatureAspect evaluates filter-targeting.
        return Objects.toString(ContextHolder.getContext().getIdentity(), "anonymous") + ":"
                + features.getObject().targeting();
    }

    @GetMapping(value = "/api/evaluate", produces = "application/json")
    @ResponseBody
    public String evaluate() {
        var context = ContextHolder.getContext();
        TogglyClient toggly = client.getIfAvailable();
        var result = new StringBuilder("{\"identity\":\"").append(json(context.getIdentity())).append("\",\"order\":\"")
                .append(json(context.getEntity() == null ? "missing" : context.getEntity().getKey()))
                .append("\",\"configured\":").append(toggly != null).append(",\"count\":")
                .append(toggly == null ? 0 : toggly.getFeatureKeys().size()).append(",\"flags\":{");
        for (int i = 0; i < Catalog.FLAGS.size(); i++) {
            String key = Catalog.FLAGS.get(i);
            if (i > 0) {
                result.append(',');
            }
            result.append('"').append(key).append("\":").append(enabled(key, context));
        }
        return result.append("}}").toString();
    }

    @GetMapping(value = "/api/flag/{key}", produces = "application/json")
    @ResponseBody
    public String flag(@PathVariable("key") String key) {
        TogglyClient toggly = client.getIfAvailable();
        return "{\"enabled\":" + enabled(key, ContextHolder.getContext()) + ",\"exists\":"
                + (toggly != null && toggly.getFeatureDefinition(key) != null) + "}";
    }

    @PostMapping(value = "/api/refresh", produces = "application/json")
    @ResponseBody
    public String refresh() {
        client.getObject().refresh();
        return "{\"attemptCompleted\":true}";
    }

    private Object allow(boolean enabled, Model model) {
        if (!enabled) {
            return ResponseEntity.status(404).body("Feature disabled");
        }
        return view("/allowed", model);
    }

    private static String json(String value) {
        if (value == null) {
            return "";
        }
        var result = new StringBuilder();
        for (char c : value.toCharArray()) {
            if (c == '"' || c == '\\') {
                result.append('\\').append(c);
            } else if (c < 32) {
                result.append(String.format("\\u%04x", (int) c));
            } else {
                result.append(c);
            }
        }
        return result.toString();
    }
}
