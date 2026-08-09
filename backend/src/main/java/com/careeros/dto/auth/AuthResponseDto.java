package com.careeros.dto.auth;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class AuthResponseDto {
    private String token;
    private String type = "Bearer";
    private String email;
    private String role;
    private String name;

    public AuthResponseDto(String token, String email, String role) {
        this(token, email, role, null);
    }

    public AuthResponseDto(String token, String email, String role, String name) {
        this.token = token;
        this.email = email;
        this.role = role;
        this.name = name;
    }
}
