package sample;

import io.toggly.core.context.*;
import io.toggly.core.model.FeatureRequirement;
import io.toggly.spring.mvc.FeatureGate;
import io.toggly.spring.mvc.FeatureArgumentResolver.FeatureFlag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import java.util.*;

/** Teaching routes are synchronous. Demo personas are not authentication or authorization. */
@Controller
public class ShowcaseController {
    private final SampleRuntime runtime;
    public ShowcaseController(SampleRuntime runtime) { this.runtime = runtime; }
    @GetMapping({"/", "/gates", "/programmatic", "/identity", "/orders", "/filters", "/mvc", "/configuration"})
    public String page(HttpServletRequest request, Model model) {
        return view(request.getRequestURI(), model);
    }
    private String view(String path, Model model) {
        var context = ContextHolder.getContext(); var client = runtime.client();
        // Configured `features` is provided by the native advice, never overwritten by sample code.
        if (client == null) model.addAttribute("features", Map.of());
        model.addAttribute("configured", client != null);
        model.addAttribute("definitions", client == null ? Set.of() : client.getFeatureKeys());
        model.addAttribute("errors", runtime.errors.get()); model.addAttribute("path", path);
        model.addAttribute("paths", Catalog.PATHS); model.addAttribute("titles", Catalog.TITLES);
        model.addAttribute("title", path.equals("/allowed") ? "Native gate allowed" : Catalog.TITLES.get(Catalog.PATHS.indexOf(path)));
        model.addAttribute("flags", Catalog.FLAGS); model.addAttribute("filters", Catalog.FILTERS);
        model.addAttribute("identity", Objects.toString(context.getIdentity(), ""));
        model.addAttribute("order", context.getEntity() == null ? "missing" : context.getEntity().getKey());
        model.addAttribute("role", context.getClaims().getOrDefault("role", ""));
        model.addAttribute("country", Objects.toString(context.getRequest().getCountry(), ""));
        model.addAttribute("language", Objects.toString(context.getRequest().getAcceptLanguage(), ""));
        model.addAttribute("userAgent", Objects.toString(context.getRequest().getUserAgent(), ""));
        model.addAttribute("vipOn", enabled("ExpressCheckout", context.withEntity(Catalog.order(true))));
        model.addAttribute("standardOn", enabled("ExpressCheckout", context.withEntity(Catalog.order(false))));
        model.addAttribute("missingOn", enabled("ExpressCheckout", context.withEntity(null)));
        model.addAttribute("apiVersion", client == null ? "unavailable" : client.getValue("api-v2", "v2", "v1"));
        model.addAttribute("allOn", gate(FeatureRequirement.ALL)); model.addAttribute("anyOn", gate(FeatureRequirement.ANY));
        return "workshop";
    }
    private boolean enabled(String key, EvaluationContext context) { return runtime.client() != null && runtime.client().isEnabled(key, context); }
    private boolean gate(FeatureRequirement requirement) {
        return runtime.client() != null && runtime.client().gate(List.of("new-dashboard", "api-v2"), requirement, false, ContextHolder.getContext());
    }
    @PostMapping("/context") public ResponseEntity<Void> saveContext() {
        // DemoContextResolver already chose context before native model advice and this method execute.
        return ResponseEntity.status(303).header("Location", "/identity").build();
    }
    @GetMapping("/gated/feature") @FeatureGate("new-dashboard")
    public String feature(Model model) { return view("/allowed", model); }
    @GetMapping("/gated/negate") @FeatureGate(value = "new-dashboard", negate = true)
    public String negate(Model model) { return view("/allowed", model); }
    @GetMapping("/gated/all") @FeatureGate({"new-dashboard", "api-v2"})
    public String all(Model model) { return view("/allowed", model); }
    @GetMapping("/gated/any") @FeatureGate(value = {"new-dashboard", "api-v2"}, matchAll = false)
    public String any(Model model) { return view("/allowed", model); }
    @GetMapping("/gated/beta") @FeatureGate("beta-access")
    public String beta(Model model) { return view("/allowed", model); }
    @PostMapping("/actions/submit") @FeatureGate(value = "enhanced-submit", status = 403)
    @ResponseBody public String submit() { return "Enhanced submit allowed (demonstration only; no order persisted)"; }
    @GetMapping("/native/argument") @ResponseBody
    public String argument(@FeatureFlag("filter-targeting") boolean enabled) {
        return Objects.toString(ContextHolder.getContext().getIdentity(), "anonymous") + ":" + enabled;
    }
    @GetMapping(value = "/api/evaluate", produces = "application/json") @ResponseBody
    public String evaluate() {
        var context = ContextHolder.getContext();
        var result = new StringBuilder("{\"identity\":\"").append(json(context.getIdentity())).append("\",\"order\":\"")
                .append(json(context.getEntity() == null ? "missing" : context.getEntity().getKey()))
                .append("\",\"configured\":").append(runtime.client() != null).append(",\"count\":")
                .append(runtime.client() == null ? 0 : runtime.client().getFeatureKeys().size()).append(",\"flags\":{");
        for (int i = 0; i < Catalog.FLAGS.size(); i++) {
            String key = Catalog.FLAGS.get(i); if (i > 0) result.append(',');
            result.append('"').append(key).append("\":").append(enabled(key, context));
        }
        return result.append("}}").toString();
    }
    @GetMapping(value = "/api/flag/{key}", produces = "application/json") @ResponseBody
    public String flag(@PathVariable("key") String key) {
        return "{\"enabled\":" + enabled(key, ContextHolder.getContext()) + ",\"exists\":"
                + (runtime.client() != null && runtime.client().getFeatureDefinition(key) != null) + "}";
    }
    @PostMapping(value = "/api/refresh", produces = "application/json") @ResponseBody
    public String refresh() {
        // refresh returns after an attempt; the provider can retain its prior signed snapshot on failure.
        runtime.client().refresh(); return "{\"attemptCompleted\":true}";
    }
    private static String json(String value) {
        if (value == null) return "";
        var result = new StringBuilder();
        for (char c : value.toCharArray()) {
            if (c == '"' || c == '\\') result.append('\\').append(c);
            else if (c < 32) result.append(String.format("\\u%04x", (int) c)); else result.append(c);
        }
        return result.toString();
    }
}
