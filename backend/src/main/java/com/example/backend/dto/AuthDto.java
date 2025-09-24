package com.example.backend.dto;

public class AuthDto {
    public static class RegisterRequest {
        public String email;
        public String password;
    }

    public static class LoginRequest {
        public String email;
        public String password;
    }

    public static class AuthResponse {
        public String token;
        public String email;
        public AuthResponse(String token, String email) { this.token = token; this.email = email; }
    }
}