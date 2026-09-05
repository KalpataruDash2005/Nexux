package com.careeros.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Arrays;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {
    // CORS is handled exclusively by Spring Security (SecurityConfig.java)
    // to prevent conflicts and ensure preflight requests are caught early.
}
