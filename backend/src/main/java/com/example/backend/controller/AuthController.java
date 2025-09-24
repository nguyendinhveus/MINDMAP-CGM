package com.example.backend.controller;

import com.example.backend.dto.AuthDto;
import com.example.backend.service.CognitoService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final CognitoService cognitoService;

    private static final Map<String, Long> tokenBlacklist = new ConcurrentHashMap<>();

    public AuthController(CognitoService cognitoService) {
        this.cognitoService = cognitoService;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody AuthDto.LoginRequest req) {
        if (req.email == null || req.password == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email and password required"));
        }
        try {
            Map<String, Object> resp = cognitoService.login(req.email, req.password);
            return ResponseEntity.ok(resp);
        } catch (Exception e) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid credentials: " + e.getMessage()));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(@RequestHeader(name = "Authorization", required = false) String auth) {
        if (auth == null || !auth.startsWith("Bearer ")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Authorization header missing"));
        }
        String token = auth.substring(7);
        tokenBlacklist.put(token, System.currentTimeMillis() + 1000L * 60 * 60);
        return ResponseEntity.ok(Map.of("logged_out", true));
    }

    public static boolean isBlacklisted(String token) {
        if (token == null) return true;
        Long exp = tokenBlacklist.get(token);
        if (exp == null) return false;
        if (exp < System.currentTimeMillis()) {
            tokenBlacklist.remove(token);
            return false;
        }
        return true;
    }
}