package sample;

import io.toggly.core.TogglyClient;
import io.toggly.spring.boot.ConditionalOnFeature;
import io.toggly.spring.boot.TogglyAutoConfiguration;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.context.annotation.Bean;

/**
 * Startup-time bean selection. {@link ConditionalOnFeature} runs once while the
 * context is created, using the current snapshot (or property defaults if the
 * client is not ready). It does not re-evaluate on later refresh.
 */
@AutoConfiguration(after = TogglyAutoConfiguration.class)
@ConditionalOnBean(TogglyClient.class)
public class FeatureBeans {

    public interface StartupCopy {
        String text();

        boolean dashboardEnabledAtStartup();
    }

    @Bean
    @ConditionalOnFeature("new-dashboard")
    public StartupCopy newDashboardCopy() {
        return new StartupCopy() {
            @Override
            public String text() {
                return "New dashboard content is visible.";
            }

            @Override
            public boolean dashboardEnabledAtStartup() {
                return true;
            }
        };
    }

    @Bean
    @ConditionalOnFeature(value = "new-dashboard", matchIfDisabled = true)
    public StartupCopy classicDashboardCopy() {
        return new StartupCopy() {
            @Override
            public String text() {
                return "Classic dashboard fallback is visible.";
            }

            @Override
            public boolean dashboardEnabledAtStartup() {
                return false;
            }
        };
    }
}
