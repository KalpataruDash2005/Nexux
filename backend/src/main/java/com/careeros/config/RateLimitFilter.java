package com.careeros.config;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final int MAX_CACHED_CLIENTS = 10_000;

    private final Map<String, Bucket> cache = new ConcurrentHashMap<>();
    private final Deque<String> insertionOrder = new ArrayDeque<>();

    private Bucket resolveBucket(String ip) {
        Bucket bucket = cache.get(ip);
        if (bucket == null) {
            bucket = cache.computeIfAbsent(ip, this::newBucket);
            synchronized (insertionOrder) {
                insertionOrder.addLast(ip);
                if (cache.size() > MAX_CACHED_CLIENTS) {
                    String oldest = insertionOrder.pollFirst();
                    if (oldest != null) {
                        cache.remove(oldest);
                    }
                }
            }
        }
        return bucket;
    }

    private Bucket newBucket(String ip) {
        // Allow 100 requests per minute
        Bandwidth limit = Bandwidth.classic(100, Refill.greedy(100, Duration.ofMinutes(1)));
        return Bucket.builder().addLimit(limit).build();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String clientIp = clientIp(request);
        Bucket bucket = resolveBucket(clientIp);

        if (bucket.tryConsume(1)) {
            filterChain.doFilter(request, response);
        } else {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.getWriter().write("Too many requests");
        }
    }

    /**
     * Behind a reverse proxy (Railway, nginx, Vercel rewrites) the remote address is
     * the proxy itself, so the first entry of X-Forwarded-For is used when available.
     */
    private String clientIp(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            int comma = forwardedFor.indexOf(',');
            String first = comma >= 0 ? forwardedFor.substring(0, comma) : forwardedFor;
            return first.trim();
        }
        return request.getRemoteAddr();
    }
}
