package sample;

import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.http.server.reactive.ReactorHttpHandlerAdapter;
import org.springframework.web.server.adapter.WebHttpHandlerBuilder;
import reactor.netty.DisposableServer;
import reactor.netty.http.server.HttpServer;
import java.time.Duration;
import io.netty.channel.group.ChannelGroup;
import io.netty.channel.group.DefaultChannelGroup;
import io.netty.util.concurrent.GlobalEventExecutor;

/** Actual production reactive socket host. No Boot, Servlet dispatcher or test-only filter chain. */
public final class Main implements AutoCloseable {
    private final DisposableServer server;
    private final AnnotationConfigApplicationContext spring;
    private final SampleRuntime runtime;
    private final ChannelGroup connections;
    private Main(DisposableServer server, AnnotationConfigApplicationContext spring, SampleRuntime runtime, ChannelGroup connections) {
        this.server = server; this.spring = spring; this.runtime = runtime; this.connections = connections;
    }
    public static void main(String[] args) throws Exception {
        var app = start(8089, SampleRuntime.fromEnvironment(System.getenv()));
        Runtime.getRuntime().addShutdownHook(new Thread(app::close));
        System.out.println("Java Spring WebFlux SDK Sample: http://localhost:8089");
        app.server.onDispose().block();
    }
    public static Main start(int port, SampleRuntime runtime) { return start(port, runtime, null); }
    static Main start(int port, SampleRuntime runtime, Class<?> testConfiguration) {
        var spring = new AnnotationConfigApplicationContext();
        spring.registerBean("sampleRuntime", SampleRuntime.class, () -> runtime, definition -> definition.setDestroyMethodName(""));
        spring.register(WebConfig.class);
        if (runtime.configured()) spring.register(NativeSdkConfig.class);
        if (testConfiguration != null) spring.register(testConfiguration);
        // The listening socket and accepted connections have separate lifetimes in Reactor Netty.
        // stayClosed also closes a connection racing with shutdown instead of leaving it untracked.
        var connections = new DefaultChannelGroup("sample-connections", GlobalEventExecutor.INSTANCE, true);
        try {
            // Initial HTTP preload is synchronous on the startup thread, before accepting traffic.
            // Failed preload is not fatal. The request pipeline still protects later empty-snapshot fetches.
            runtime.start(); spring.refresh();
            var handler = WebHttpHandlerBuilder.applicationContext(spring).build();
            var server = HttpServer.create().host("127.0.0.1").port(port)
                    .channelGroup(connections).handle(new ReactorHttpHandlerAdapter(handler)).bindNow();
            return new Main(server, spring, runtime, connections);
        } catch (RuntimeException error) { connections.close().awaitUninterruptibly(); spring.close(); runtime.close(); throw error; }
    }
    public SampleRuntime runtime() { return runtime; }
    public String url() { return "http://127.0.0.1:" + server.port(); }
    @Override public void close() {
        // Stop HTTP work first. Only the runtime owns the core client and its default provider.
        try {
            server.dispose();
            // Closing only the listening socket does not cancel already accepted HTTP requests.
            // Cancel accepted subscriptions before releasing their shared evaluation client.
            if (!connections.close().awaitUninterruptibly(10_000)) {
                throw new IllegalStateException("Timed out closing active HTTP connections");
            }
            server.onDispose().block(Duration.ofSeconds(10));
        }
        finally { try { spring.close(); } finally { runtime.close(); } }
    }
}
