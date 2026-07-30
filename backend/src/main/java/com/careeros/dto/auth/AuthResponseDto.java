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
    
    public AuthResponseDto(String token, String email, String role) {
        this.token = token;
        this.email = email;
        this.role = role;
    }
}
