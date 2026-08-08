package com.careeros.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationFailureHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Component
@Slf4j
public class OAuth2AuthenticationFailureHandler extends SimpleUrlAuthenticationFailureHandler {

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    @Override
    public void onAuthenticationFailure(HttpServletRequest request, HttpServletResponse response, AuthenticationException exception) throws IOException {
        log.warn("OAuth2 login FAILED for uri={} fromHost={} cookies=[{}] error={}",
                request.getRequestURI(),
                request.getHeader("Host"),
                request.getCookies() != null ? java.util.Arrays.stream(request.getCookies()).map(c -> c.getName()).collect(java.util.stream.Collectors.toList()) : "none",
                exception.getMessage(),
                exception);
        String base = frontendUrl.endsWith("/") ? frontendUrl.substring(0, frontendUrl.length() - 1) : frontendUrl;
        String message = exception.getMessage() != null ? exception.getMessage() : "Google authentication failed";
        String targetUrl = base + "/auth?error=" + URLEncoder.encode(message, StandardCharsets.UTF_8);
        getRedirectStrategy().sendRedirect(request, response, targetUrl);
    }
}