package sample;

import io.toggly.core.context.EvaluationContext;
import io.toggly.spring.webflux.*;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.result.view.Rendering;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.*;
import reactor.core.scheduler.Schedulers;
import java.time.Duration;
import java.util.*;
import java.util.function.Supplier;

/** Each returned publisher reads the native subscription context; no request ThreadLocal or global identity. */
@Controller
public class ShowcaseController {
    private final SampleRuntime runtime;
    private final ReactiveTogglyClient reactive;
    public ShowcaseController(SampleRuntime runtime, ReactiveTogglyClient reactive) { this.runtime=runtime;this.reactive=reactive; }
    static <T> Mono<T> offload(Supplier<Mono<T>> operation) {
        // Repeat this at each native operation boundary: a preceding delay/publishOn may change the worker.
        return Mono.defer(operation).subscribeOn(Schedulers.boundedElastic());
    }
    private Mono<Boolean> enabled(String key, EvaluationContext context) {
        return reactive == null ? Mono.just(false) : offload(() -> reactive.isEnabled(key, context));
    }
    private Mono<Map<String,Boolean>> features() {
        return reactive == null ? Mono.just(Map.of()) : offload(reactive::evaluateAll);
    }
    private Mono<Set<String>> definitions() {
        return reactive == null ? Mono.just(Set.of()) : offload(reactive::getFeatureKeys);
    }
    @GetMapping({"/","/gates","/programmatic","/identity","/orders","/filters","/webflux","/configuration"})
    public Mono<Rendering> page(ServerWebExchange exchange) { return view(exchange.getRequest().getPath().value()); }
    private Mono<Rendering> view(String path) {
        return TogglyContextFilter.getContext().flatMap(context -> {
            var model = new HashMap<String,Object>();
            model.put("configured", reactive != null);model.put("path",path);
            model.put("paths",Catalog.PATHS);model.put("titles",Catalog.TITLES);
            model.put("title",path.equals("/allowed") ? "Native gate allowed" : Catalog.TITLES.get(Catalog.PATHS.indexOf(path)));
            model.put("flags",Catalog.FLAGS);model.put("filters",Catalog.FILTERS);
            model.put("identity",Objects.toString(context.getIdentity(),""));
            model.put("order",context.getEntity()==null ? "missing" : context.getEntity().getKey());
            model.put("role",context.getClaims().getOrDefault("role",""));
            model.put("country",Objects.toString(context.getRequest().getCountry(),""));
            model.put("language",Objects.toString(context.getRequest().getAcceptLanguage(),""));
            model.put("userAgent",Objects.toString(context.getRequest().getUserAgent(),""));
            // These comparisons share one user context and vary only the entity. No Boolean result caching.
            return Mono.zip(features(),definitions(),enabled("ExpressCheckout",context.withEntity(Catalog.order(true))),
                    enabled("ExpressCheckout",context.withEntity(Catalog.order(false))),enabled("ExpressCheckout",context.withEntity(null)))
                    .flatMap(values -> {
                        model.put("features",values.getT1());model.put("definitions",values.getT2());
                        model.put("vipOn",values.getT3());model.put("standardOn",values.getT4());model.put("missingOn",values.getT5());
                        Mono<Boolean> all = reactive==null ? Mono.just(false) : offload(() -> reactive.allEnabled(List.of("new-dashboard","api-v2")));
                        Mono<Boolean> any = reactive==null ? Mono.just(false) : offload(() -> reactive.anyEnabled(List.of("new-dashboard","api-v2")));
                        // switchOn selects caller publishers from a Boolean result. It is not variant allocation.
                        Mono<String> version = reactive==null ? Mono.just("unavailable") : offload(() -> reactive.switchOn("api-v2",Mono.just("v2"),Mono.just("v1")));
                        return Mono.zip(all,any,version).map(branches -> {
                            model.put("allOn",branches.getT1());model.put("anyOn",branches.getT2());model.put("apiVersion",branches.getT3());
                            model.put("errors",runtime.errors.get());
                            return Rendering.view("workshop").model(model).build();
                        });
                    });
        });
    }
    @PostMapping("/context") public ResponseEntity<Void> saveContext() {
        // Resolver awaited the body/session and installed context before this handler is invoked.
        return ResponseEntity.status(303).header("Location","/identity").build();
    }
    @GetMapping({"/gated/feature","/gated/negate","/gated/all","/gated/any","/gated/beta","/gated/unknown"})
    public Mono<Rendering> gated() { return view("/allowed"); }
    @PostMapping("/actions/submit") @ResponseBody public Mono<String> submit() {
        // Native FeatureGateFilter already protects the action; no order is persisted by this teaching route.
        return offload(() -> reactive.ifEnabled("enhanced-submit",Mono.fromSupplier(() -> "Enhanced submit allowed (demonstration only; no order persisted)")))
                .defaultIfEmpty("Enhanced submit became disabled before action evaluation");
    }
    @GetMapping("/native/reactive") @ResponseBody public Mono<String> nativeReactive() {
        // Deliberately leave the first worker. Reactor context survives; no ThreadLocal propagation is used.
        return Mono.delay(Duration.ofMillis(15)).then(TogglyContextFilter.getContext())
                .flatMap(context -> offload(() -> reactive.isEnabled("filter-targeting"))
                        .map(on -> Objects.toString(context.getIdentity(),"anonymous")+":"+on));
    }
    @GetMapping("/native/enabled") @ResponseBody public Mono<String> enabledFeatures() {
        return offload(() -> reactive.enabledFeatures().collectList()).map(keys -> String.join(",",new TreeSet<>(keys)));
    }
    @GetMapping(value="/api/evaluate",produces="application/json") @ResponseBody public Mono<String> evaluate() {
        // An actual asynchronous request path used by the isolation tests, not a manually composed test chain.
        return Mono.delay(Duration.ofMillis(10)).then(TogglyContextFilter.getContext()).flatMap(context ->
            Mono.zip(features(),definitions()).map(values -> {
                var result=new StringBuilder("{\"identity\":\"").append(json(context.getIdentity())).append("\",\"order\":\"")
                        .append(json(context.getEntity()==null?"missing":context.getEntity().getKey()))
                        .append("\",\"configured\":").append(reactive!=null).append(",\"count\":").append(values.getT2().size()).append(",\"flags\":{");
                for(int i=0;i<Catalog.FLAGS.size();i++) {String key=Catalog.FLAGS.get(i);if(i>0) result.append(',');
                    result.append('"').append(key).append("\":").append(values.getT1().getOrDefault(key,false));}
                return result.append("}}").toString();
            }));
    }
    @GetMapping(value="/api/flag/{key}",produces="application/json") @ResponseBody public Mono<String> flag(@PathVariable("key")String key) {
        return TogglyContextFilter.getContext().flatMap(context -> enabled(key,context).flatMap(on -> {
            Mono<Boolean> exists=reactive==null?Mono.just(false):offload(() -> reactive.getFeatureDefinition(key).hasElement());
            return exists.map(found -> "{\"enabled\":"+on+",\"exists\":"+found+"}");
        }));
    }
    @PostMapping(value="/api/refresh",produces="application/json") @ResponseBody public Mono<String> refresh() {
        // The native refresh wrapper already offloads. Completion means an attempt, not an accepted revision.
        return reactive.refresh().thenReturn("{\"attemptCompleted\":true}");
    }
    private static String json(String value) {
        if(value==null)return "";var result=new StringBuilder();
        for(char c:value.toCharArray()) {if(c=='"'||c=='\\')result.append('\\').append(c);
            else if(c<32)result.append(String.format("\\u%04x",(int)c));else result.append(c);}
        return result.toString();
    }
}
