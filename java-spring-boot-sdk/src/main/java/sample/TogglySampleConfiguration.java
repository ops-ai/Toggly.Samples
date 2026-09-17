package sample;

import io.toggly.core.TogglyClient;
import io.toggly.core.config.TogglyConfig;
import io.toggly.core.snapshot.HttpSnapshotProvider;
import io.toggly.core.snapshot.SnapshotProvider;
import io.toggly.spring.boot.FeatureAspect;
import io.toggly.spring.boot.TogglyProperties;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

/**
 * Completes starter auto-configuration with the surfaces the published 1.6.0
 * starter does not bind: signed definitions, a non-null HTTP provider, and the
 * {@link FeatureAspect} bean. This is ordinary Boot configuration against
 * published types, not a local jar or source substitution.
 */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(TogglyProperties.class)
@ConditionalOnProperty(prefix = "toggly", name = "enabled", havingValue = "true")
public class TogglySampleConfiguration {

    @Bean
    public TogglyConfig togglyConfig(TogglyProperties properties, Environment environment, SampleDiagnostics diagnostics) {
        // Prefer Environment (command-line/test args) over TogglyProperties defaults.
        // properties.getBaseUrl() is never blank, so it would hide --toggly.base-url.
        String appKey = firstNonBlank(environment.getProperty("toggly.app-key"), properties.getAppKey());
        TogglyConfig.Builder builder = TogglyConfig.builder()
                .appKey(appKey)
                .environment(firstNonBlank(environment.getProperty("toggly.environment"), properties.getEnvironment(), "Production"))
                .baseUrl(firstNonBlank(environment.getProperty("toggly.base-url"), properties.getBaseUrl(), "https://definitions.toggly.io"))
                .metricsBaseUrl(properties.getMetricsBaseUrl())
                .refreshIntervalSeconds(environment.getProperty("toggly.refresh-interval-seconds", Long.class,
                        properties.getRefreshIntervalSeconds()))
                .defaultFeatureState(properties.isDefaultFeatureState())
                .enableUsageTracking(environment.getProperty("toggly.enable-usage-tracking", Boolean.class,
                        properties.isEnableUsageTracking()))
                .enableMetrics(environment.getProperty("toggly.enable-metrics", Boolean.class, properties.isEnableMetrics()))
                .usageFlushInterval(properties.getUsageFlushInterval())
                .metricsFlushInterval(properties.getMetricsFlushInterval())
                .instanceName(properties.getInstanceName())
                .appVersion(properties.getAppVersion())
                .registerContextsOnStartup(environment.getProperty("toggly.register-contexts-on-startup", Boolean.class,
                        properties.isRegisterContextsOnStartup()))
                .useSignedDefinitions(true)
                .enableLiveUpdates(false)
                .onError((message, error) -> diagnostics.errors.incrementAndGet());
        if (properties.getDefaultIdentity() != null) {
            builder.defaultIdentity(properties.getDefaultIdentity());
        }
        if (properties.getFeatureDefaults() != null) {
            properties.getFeatureDefaults().forEach(builder::featureDefault);
        }
        return builder.build();
    }

    private static String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    @Bean(destroyMethod = "close")
    public SnapshotProvider snapshotProvider(TogglyConfig config) {
        // Starter snapshotProvider() returns null. Boot 3.5 then refuses to inject
        // it into togglyClient, so the auto-configured client never starts.
        // A Spring-owned HttpSnapshotProvider is the published workaround; the
        // starter client still constructs TogglyClient(config, provider).
        return new HttpSnapshotProvider(config);
    }

    @Bean
    public FeatureAspect featureAspect(TogglyClient client) {
        // FeatureAspect is not registered by TogglyAutoConfiguration. starter-aop
        // enables proxies; this bean is the published AOP gate.
        return new FeatureAspect(client);
    }

    @Bean
    @ConditionalOnBean(TogglyClient.class)
    public ApplicationRunner initialRefresh(TogglyClient client) {
        // Startup refresh so @ConditionalOnFeature and the first page see a snapshot.
        // refresh() means an attempt finished; a failed signature keeps last-good.
        return args -> client.refresh();
    }
}
