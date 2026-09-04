package com.careeros.security;

import com.careeros.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@Profile("dev")
@RequiredArgsConstructor
@Slf4j
public class DevAuthenticationFilter extends OncePerRequestFilter {

    private final UserRepository userRepository;
    private final CustomUserDetailsService userDetailsService;
    
    private static final String DEV_USER_ID = "e45f31fb-fc15-4950-a7b7-7266c8afc0e6";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        
        // Only trigger if no valid authentication exists
        if (SecurityContextHolder.getContext().getAuthentication() == null ||
            "anonymousUser".equals(SecurityContextHolder.getContext().getAuthentication().getName())) {
            
            try {
                userRepository.findById(DEV_USER_ID).ifPresent(user -> {
                    UserDetails userDetails = userDetailsService.loadUserByUsername(user.getEmail());
                    UsernamePasswordAuthenticationToken authentication =
                            new UsernamePasswordAuthenticationToken(
                                    userDetails,
                                    null,
                                    userDetails.getAuthorities());
                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                    SecurityContextHolder.getContext().setAuthentication(authentication);
                    log.info("DEV MODE: Injected mock authentication for user email: {}", user.getEmail());
                });
            } catch (Exception e) {
                log.warn("DEV MODE: Failed to inject mock authentication - {}", e.getMessage());
            }
        }
        
        filterChain.doFilter(request, response);
    }
}
