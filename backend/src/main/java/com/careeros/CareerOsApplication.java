package com.careeros;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class CareerOsApplication {
    public static void main(String[] args) {
        SpringApplication.run(CareerOsApplication.class, args);
    }
}
