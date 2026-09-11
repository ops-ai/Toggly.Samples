package sample;

import io.toggly.core.context.ContextHolder;
import io.toggly.spring.webflux.*;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.*;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.WebFilter;
import reactor.core.publisher.*;
import reactor.core.scheduler.Schedulers;
import reactor.test.StepVerifier;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import java.util.logging.*;
import static org.junit.jupiter.api.Assertions.*;

class ReactiveIsolationTest {
    static final AtomicInteger cleanupLeaks = new AtomicInteger();
    @Configuration static class ProbeConfig {
        @Bean ProbeController probeController(ReactiveTogglyClient reactive) { return new ProbeController(reactive); }
        @Bean @Order(-85) WebFilter checkOffload() {
            return (exchange, chain) -> {
                assertFalse(ContextHolder.hasContext(), "native reactive request must not install ThreadLocal");
                assertFalse(Schedulers.isInNonBlockingThread(), "gate executes on bounded worker even after asynchronous resolver");
                return chain.filter(exchange).doFinally(signal -> { if (ContextHolder.hasContext()) cleanupLeaks.incrementAndGet(); });
            };
        }
    }
    @Controller static class ProbeController {
        static volatile CountDownLatch entered, cancelled;
        static final AtomicReference<String> seen = new AtomicReference<>();
        static final AtomicReference<String> errorSeen = new AtomicReference<>();
        final ReactiveTogglyClient reactive;
        ProbeController(ReactiveTogglyClient reactive) { this.reactive=reactive; }
        @GetMapping("/test/error") @ResponseBody Mono<String> error() {
            return Mono.delay(Duration.ofMillis(5)).then(TogglyContextFilter.getContext()).flatMap(context ->
                ShowcaseController.offload(() -> reactive.isEnabled("filter-targeting")).flatMap(on -> {
                    errorSeen.set(context.getIdentity()+":"+on);
                    return Mono.error(new IllegalStateException("intentional async error"));
                }));
        }
        @GetMapping("/test/cancel") @ResponseBody Mono<String> cancel() {
            return Mono.delay(Duration.ofMillis(5)).then(TogglyContextFilter.getContext()).flatMap(context ->
                ShowcaseController.offload(() -> reactive.isEnabled("ExpressCheckout")).flatMap(on -> {
                    seen.set(context.getIdentity()+":"+context.getEntity().getKey()+":"+on);entered.countDown();
                    return Mono.<String>never();
                })).doFinally(signal -> {if(signal==SignalType.CANCEL)cancelled.countDown();});
        }
    }
    private static HttpResponse<String> get(HttpClient http,Main app,String path) throws Exception {
        return http.send(HttpRequest.newBuilder(URI.create(app.url()+path)).timeout(Duration.ofSeconds(10)).build(),HttpResponse.BodyHandlers.ofString());
    }
    @Test void actualHostConcurrentDelayedUsersOrdersNativeGatesAndErrorsStayIsolated() throws Exception {
        try(var defs=new DefinitionsServer();var app=Main.start(0,defs.lifecycle(),ProbeConfig.class);var http=HttpClient.newHttpClient()) {
            var calls=new ArrayList<CompletableFuture<Void>>();
            for(int i=0;i<80;i++) {
                boolean alice=i%2==0;
                String preset=alice?"matching":"nonmatching";
                calls.add(http.sendAsync(HttpRequest.newBuilder(URI.create(app.url()+"/api/evaluate?preset="+preset)).build(),HttpResponse.BodyHandlers.ofString())
                        .thenAccept(response -> {assertEquals(200,response.statusCode());String body=response.body();
                            assertTrue(body.contains("\"identity\":\""+(alice?"alice":"bob")+"\""),body);
                            assertTrue(body.contains("\"order\":\""+(alice?"ord-vip":"ord-standard")+"\""),body);
                            assertTrue(body.contains("\"ExpressCheckout\":"+alice),body);
                            assertTrue(body.contains("\"filter-targeting\":"+alice),body);}));
                calls.add(http.sendAsync(HttpRequest.newBuilder(URI.create(app.url()+"/gated/beta?preset="+preset)).build(),HttpResponse.BodyHandlers.ofString())
                        .thenAccept(response -> assertEquals(alice?200:404,response.statusCode())));
            }
            CompletableFuture.allOf(calls.toArray(CompletableFuture[]::new)).get(25,TimeUnit.SECONDS);
            assertEquals(500,get(http,app,"/test/error?preset=matching").statusCode());
            assertEquals("alice:true",ProbeController.errorSeen.get());
            assertEquals("bob:false",get(http,app,"/native/reactive?preset=nonmatching").body());
            assertEquals("anonymous:false",get(http,app,"/native/reactive").body());
            assertEquals(0,cleanupLeaks.get());assertFalse(ContextHolder.hasContext());assertNull(TogglyContextFilter.getContext().block().getIdentity());
        }
    }
    @Test void cancelledRealHttpSubscriptionDoesNotLeakOrCloseSharedClient() throws Exception {
        ProbeController.entered=new CountDownLatch(1);ProbeController.cancelled=new CountDownLatch(1);
        try(var defs=new DefinitionsServer();var app=Main.start(0,defs.lifecycle(),ProbeConfig.class);var http=HttpClient.newHttpClient()) {
            var pending=http.sendAsync(HttpRequest.newBuilder(URI.create(app.url()+"/test/cancel?preset=matching")).build(),HttpResponse.BodyHandlers.ofString());
            assertTrue(ProbeController.entered.await(5,TimeUnit.SECONDS));assertEquals("alice:ord-vip:true",ProbeController.seen.get());
            assertTrue(pending.cancel(true));assertTrue(ProbeController.cancelled.await(5,TimeUnit.SECONDS),"actual socket cancellation must reach controller");
            assertEquals("bob:false",get(http,app,"/native/reactive?preset=nonmatching").body());
            assertTrue(get(http,app,"/api/evaluate?preset=nonmatching").body().contains("\"ExpressCheckout\":false"));
            assertEquals(0,cleanupLeaks.get());assertNull(TogglyContextFilter.getContext().block().getIdentity());assertFalse(ContextHolder.hasContext());
        }
    }
    @Test void shutdownCancelsActiveRequestBeforeReleasingClient() throws Exception {
        ProbeController.entered=new CountDownLatch(1);ProbeController.cancelled=new CountDownLatch(1);
        try(var defs=new DefinitionsServer();var http=HttpClient.newHttpClient()) {
            var runtime=defs.lifecycle();var app=Main.start(0,runtime,ProbeConfig.class);
            var pending=http.sendAsync(HttpRequest.newBuilder(URI.create(app.url()+"/test/cancel?preset=matching")).build(),HttpResponse.BodyHandlers.ofString());
            try {
                assertTrue(ProbeController.entered.await(5,TimeUnit.SECONDS));
                app.close();
                assertTrue(ProbeController.cancelled.await(2,TimeUnit.SECONDS),"host shutdown must cancel accepted active work");
                assertNull(runtime.client());
            } finally {pending.cancel(true);app.close();}
        }
    }
    @Test void invalidColdFetchInNativeGateAndDelayedWrapperRunsOffEventLoop() throws Exception {
        var observed=new CopyOnWriteArrayList<Boolean>();
        Handler handler=new Handler() {
            public void publish(LogRecord record) {
                if(record.getMessage().contains("Signature verification failed")) observed.add(Schedulers.isInNonBlockingThread());
            }
            public void flush() {} public void close() {}
        };
        Logger logger=Logger.getLogger("io.toggly.core.snapshot.HttpSnapshotProvider");logger.addHandler(handler);
        try(var defs=new DefinitionsServer()) {
            defs.envelope=defs.envelope.replace("\"name\":\"AlwaysOn\"","\"name\":\"AlwaysOff\"");
            try(var app=Main.start(0,defs.lifecycle(),ProbeConfig.class);var http=HttpClient.newHttpClient()) {
                for(String route:List.of("/gated/feature","/native/reactive?preset=matching","/api/evaluate?preset=matching")) {
                    observed.clear();int before=defs.fetches.get();var response=get(http,app,route);
                    assertEquals(route.startsWith("/gated")?404:200,response.statusCode());
                    assertTrue(defs.fetches.get()>before,"cold call must exercise actual HTTP transport");
                    assertFalse(observed.isEmpty(),"real synchronous signature failure must be observed");
                    assertFalse(observed.contains(true),"native cold HTTP must not execute on Reactor nonblocking worker");
                }
                defs.publish(true);
                assertEquals("alice:true",get(http,app,"/native/reactive?preset=matching").body());
            }
        } finally {logger.removeHandler(handler);}
    }
    @Test void nativeConditionalPublishersAreLazyAndCancellationKeepsContextLocal() throws Exception {
        try(var defs=new DefinitionsServer();var app=Main.start(0,defs.lifecycle())) {
            var reactive=new ReactiveTogglyClient(app.runtime().client());
            var alice=io.toggly.core.context.EvaluationContext.builder().identity("alice").entity(Catalog.order(true)).build();
            var bob=alice.withIdentity("bob");
            var actions=new AtomicInteger();
            StepVerifier.create(ShowcaseController.offload(() -> reactive.ifEnabled("filter-targeting",Mono.fromSupplier(actions::incrementAndGet)))
                    .contextWrite(ctx -> ctx.put(TogglyContextFilter.CONTEXT_KEY,bob))).verifyComplete();
            assertEquals(0,actions.get());
            StepVerifier.create(ShowcaseController.offload(() -> reactive.switchOn("filter-targeting",Mono.just("new"),Mono.just("classic")))
                    .contextWrite(ctx -> ctx.put(TogglyContextFilter.CONTEXT_KEY,alice))).expectNext("new").verifyComplete();
            StepVerifier.create(ShowcaseController.offload(() -> reactive.noneEnabled(List.of("api-v2")))).expectNext(true).verifyComplete();
            StepVerifier.create(ShowcaseController.offload(() -> reactive.gate(List.of("ExpressCheckout"),io.toggly.core.model.FeatureRequirement.ALL,false,alice)))
                    .expectNext(true).verifyComplete();
            StepVerifier.create(Mono.delay(Duration.ofSeconds(10)).then(reactive.isEnabled("filter-targeting"))
                    .contextWrite(ctx -> ctx.put(TogglyContextFilter.CONTEXT_KEY,alice))).thenCancel().verify();
            StepVerifier.create(reactive.isEnabled("filter-targeting")).expectNext(false).verifyComplete();
            assertFalse(ContextHolder.hasContext());
            // Do not close this borrowed wrapper: application runtime is the sole owner.
        }
    }
}
