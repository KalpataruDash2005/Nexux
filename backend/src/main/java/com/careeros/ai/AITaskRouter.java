package com.careeros.ai;

import com.careeros.ai.provider.AIProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

@Component
@RequiredArgsConstructor
@Slf4j
public class AITaskRouter {

    private final ConcurrentHashMap<String, RouteMetrics> metrics = new ConcurrentHashMap<>();
    private static final int CIRCUIT_BREAKER_THRESHOLD = 3;

    public List<AITaskRoute> getRoutes(AITask task, List<AIProvider> availableProviders) {
        List<RouteSpec> specs;
        
        switch (task) {
            case PLACEMENT_READINESS:
            case PLACEMENT_ROADMAP:
                specs = List.of(
                    new RouteSpec("OPENROUTER", "minimax/minimax-m3:free"),
                    new RouteSpec("GROQ", "openai/gpt-oss-20b"),
                    new RouteSpec("GEMINI", "gemini-3.6-flash")
                );
                break;
            case GENERAL_CHAT:
            case INTERVIEW_ASSISTANCE:
            case APTITUDE_GENERATION:
            case RESUME_ANALYSIS:
            case CODING_ASSISTANCE:
            default:
                specs = List.of(
                    new RouteSpec("GROQ", "openai/gpt-oss-20b"),
                    new RouteSpec("OPENROUTER", "minimax/minimax-m3:free"),
                    new RouteSpec("GEMINI", "gemini-3.6-flash")
                );
                break;
        }

        List<AITaskRoute> routes = new ArrayList<>();
        
        for (RouteSpec spec : specs) {
            for (AIProvider p : availableProviders) {
                if (p.getName().equalsIgnoreCase(spec.provider())) {
                    String key = getMetricKey(task, p.getName(), spec.model());
                    RouteMetrics m = metrics.get(key);
                    if (m != null && m.consecutiveFailures.get() >= CIRCUIT_BREAKER_THRESHOLD) {
                        log.warn("[CIRCUIT-BREAKER] Skipping route {} for task {} due to {} consecutive failures", spec, task, m.consecutiveFailures.get());
                    } else {
                        routes.add(new AITaskRoute(p, spec.model()));
                    }
                    break;
                }
            }
        }
        
        // Ensure at least one route exists if all are broken
        if (routes.isEmpty() && !specs.isEmpty() && !availableProviders.isEmpty()) {
            RouteSpec firstSpec = specs.get(0);
            for (AIProvider p : availableProviders) {
                if (p.getName().equalsIgnoreCase(firstSpec.provider())) {
                    routes.add(new AITaskRoute(p, firstSpec.model()));
                    break;
                }
            }
        }
        
        return routes;
    }

    public void recordSuccess(AITask task, String provider, String model, long durationMs) {
        RouteMetrics m = getOrCreateMetrics(task, provider, model);
        m.successCount.incrementAndGet();
        m.consecutiveFailures.set(0);
        
        long currentAvg = m.averageLatencyMs.get();
        long totalSuccess = m.successCount.get();
        if (totalSuccess == 1) {
            m.averageLatencyMs.set(durationMs);
        } else {
            m.averageLatencyMs.set(currentAvg + (durationMs - currentAvg) / totalSuccess);
        }
    }

    public void recordFailure(AITask task, String provider, String model, String reason) {
        RouteMetrics m = getOrCreateMetrics(task, provider, model);
        m.failureCount.incrementAndGet();
        m.consecutiveFailures.incrementAndGet();
        
        if ("FINISH_REASON_LENGTH".equals(reason)) {
            m.finishReasonLengthCount.incrementAndGet();
        } else if ("INVALID_JSON".equals(reason)) {
            m.invalidJsonCount.incrementAndGet();
        } else if ("EMPTY_RESPONSE".equals(reason)) {
            m.emptyResponseCount.incrementAndGet();
        }
    }

    private String getMetricKey(AITask task, String provider, String model) {
        return task.name() + ":" + provider + ":" + model;
    }

    private RouteMetrics getOrCreateMetrics(AITask task, String provider, String model) {
        return metrics.computeIfAbsent(getMetricKey(task, provider, model), k -> new RouteMetrics());
    }

    public void dumpMetrics() {
        log.info("--- ROUTE METRICS ---");
        metrics.forEach((k, m) -> {
            log.info("Route {}: Success={}, Fail={} (Consecutive={}), AvgLatency={}ms, LengthFails={}, JsonFails={}, EmptyFails={}",
                    k, m.successCount.get(), m.failureCount.get(), m.consecutiveFailures.get(),
                    m.averageLatencyMs.get(), m.finishReasonLengthCount.get(),
                    m.invalidJsonCount.get(), m.emptyResponseCount.get());
        });
        log.info("---------------------");
    }

    private record RouteSpec(String provider, String model) {}

    private static class RouteMetrics {
        final AtomicInteger successCount = new AtomicInteger(0);
        final AtomicInteger failureCount = new AtomicInteger(0);
        final AtomicInteger consecutiveFailures = new AtomicInteger(0);
        final AtomicLong averageLatencyMs = new AtomicLong(0);
        final AtomicInteger finishReasonLengthCount = new AtomicInteger(0);
        final AtomicInteger invalidJsonCount = new AtomicInteger(0);
        final AtomicInteger emptyResponseCount = new AtomicInteger(0);
    }
}
