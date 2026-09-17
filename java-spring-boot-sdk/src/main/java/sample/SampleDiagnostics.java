package sample;

import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.stereotype.Component;

/** Process-wide refresh error counter. It is not per-user or per-Order state. */
@Component
public class SampleDiagnostics {
    public final AtomicInteger errors = new AtomicInteger();
}
