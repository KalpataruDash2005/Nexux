package com.careeros.security;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.client.web.AuthorizationRequestRepository;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;

@Component
public class CookieOAuth2AuthorizationRequestRepository
        implements AuthorizationRequestRepository<OAuth2AuthorizationRequest> {

    private static final String COOKIE_NAME = "nexora_oauth2";
    private static final long MAX_AGE_SECONDS = 300;
    private static final String HMAC_ALGORITHM = "HmacSHA256";

    private final byte[] signingKey;
    private final boolean cookieSecure;

    public CookieOAuth2AuthorizationRequestRepository(
            @Value("${app.oauth.cookie-secret:nexora-dev-cookie-secret-change-me}") String cookieSecret,
            @Value("${app.oauth.cookie-secure:false}") boolean cookieSecure) {
        this.signingKey = cookieSecret.getBytes(StandardCharsets.UTF_8);
        this.cookieSecure = cookieSecure;
    }

    @Override
    public OAuth2AuthorizationRequest loadAuthorizationRequest(HttpServletRequest request) {
        Cookie cookie = findCookie(request);
        if (cookie == null) {
            return null;
        }
        return decode(cookie.getValue());
    }

    @Override
    public void saveAuthorizationRequest(OAuth2AuthorizationRequest authorizationRequest,
                                         HttpServletRequest request,
                                         HttpServletResponse response) {
        if (authorizationRequest == null) {
            expireCookie(response);
            return;
        }
        try {
            String value = encodeSigned(authorizationRequest);
            Cookie cookie = new Cookie(COOKIE_NAME, value);
            cookie.setHttpOnly(true);
            cookie.setSecure(cookieSecure);
            cookie.setPath("/");
            cookie.setMaxAge((int) MAX_AGE_SECONDS);
            cookie.setAttribute("SameSite", "Lax");
            response.addCookie(cookie);
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to persist OAuth2 authorization request", ex);
        }
    }

    @Override
    public OAuth2AuthorizationRequest removeAuthorizationRequest(HttpServletRequest request,
                                                                 HttpServletResponse response) {
        OAuth2AuthorizationRequest loaded = loadAuthorizationRequest(request);
        expireCookie(response);
        return loaded;
    }

    private OAuth2AuthorizationRequest decode(String value) {
        String[] parts = value.split("\\.", -1);
        if (parts.length != 2) {
            return null;
        }
        String payload = parts[0];
        String providedMac = parts[1];
        String expectedMac = mac(payload);
        if (!MessageDigest.isEqual(
                expectedMac.getBytes(StandardCharsets.UTF_8),
                providedMac.getBytes(StandardCharsets.UTF_8))) {
            return null;
        }
        try {
            byte[] bytes = Base64.getUrlDecoder().decode(payload);
            return deserialize(bytes);
        } catch (Exception ex) {
            return null;
        }
    }

    private String encodeSigned(OAuth2AuthorizationRequest authorizationRequest) throws IOException {
        byte[] bytes = serialize(authorizationRequest);
        String payload = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        return payload + "." + mac(payload);
    }

    private String mac(String data) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(signingKey, HMAC_ALGORITHM));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(
                    mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException | InvalidKeyException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private byte[] serialize(OAuth2AuthorizationRequest authorizationRequest) throws IOException {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        try (ObjectOutputStream output = new ObjectOutputStream(buffer)) {
            output.writeObject(authorizationRequest);
        }
        return buffer.toByteArray();
    }

    private OAuth2AuthorizationRequest deserialize(byte[] bytes) throws IOException, ClassNotFoundException {
        try (ObjectInputStream input = new ObjectInputStream(new ByteArrayInputStream(bytes))) {
            return (OAuth2AuthorizationRequest) input.readObject();
        }
    }

    private Cookie findCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if (COOKIE_NAME.equals(cookie.getName())) {
                return cookie;
            }
        }
        return null;
    }

    private void expireCookie(HttpServletResponse response) {
        Cookie cookie = new Cookie(COOKIE_NAME, "");
        cookie.setHttpOnly(true);
        cookie.setSecure(cookieSecure);
        cookie.setPath("/");
        cookie.setMaxAge(0);
        response.addCookie(cookie);
    }
}