package com.example.backend.service;

import com.example.backend.util.CognitoUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jdk8.Jdk8Module;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;

import java.util.Arrays;
import java.util.Map;

@Service
public class CognitoService {

    private final String clientId = "53dnt9mp3e5enn7kcsd4mhuksd";
    private final String clientSecret = "1vh4cpm093kvgjppm66kiku731jja093runh3qnrvnvr05bjs98";
    private final String region = "ap-southeast-2";
    private final String cognitoUrl = "https://cognito-idp." + region + ".amazonaws.com/";

    private final RestTemplate restTemplate;

    public CognitoService() {
        this.restTemplate = createRestTemplate();
    }

    private RestTemplate createRestTemplate() {
        RestTemplate restTemplate = new RestTemplate();
        ObjectMapper objectMapper = new ObjectMapper();
        objectMapper.registerModule(new Jdk8Module()); // Hỗ trợ ImmutableCollections
        MappingJackson2HttpMessageConverter converter = new MappingJackson2HttpMessageConverter();
        converter.setObjectMapper(objectMapper);
        converter.setSupportedMediaTypes(Arrays.asList(
                MediaType.APPLICATION_JSON,
                new MediaType("application", "x-amz-json-1.1")
        ));
        restTemplate.getMessageConverters().add(0, converter);
        return restTemplate;
    }

    public Map<String, Object> login(String username, String password) {
        try {
            String secretHash = CognitoUtil.calculateSecretHash(username, clientId, clientSecret);

            Map<String, Object> body = Map.of(
                    "AuthParameters", Map.of(
                            "USERNAME", username,
                            "PASSWORD", password,
                            "SECRET_HASH", secretHash
                    ),
                    "AuthFlow", "USER_PASSWORD_AUTH",
                    "ClientId", clientId
            );

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(new MediaType("application", "x-amz-json-1.1"));
            headers.set("X-Amz-Target", "AWSCognitoIdentityProviderService.InitiateAuth");

            ResponseEntity<Map> response = restTemplate.exchange(
                    cognitoUrl,
                    HttpMethod.POST,
                    new HttpEntity<>(body, headers),
                    Map.class
            );

            if (!response.getStatusCode().is2xxSuccessful()) {
                throw new RuntimeException("Cognito error: " + response.getBody());
            }

            return response.getBody();
        } catch (Exception e) {
            throw new RuntimeException("Login failed: " + e.getMessage(), e);
        }
    }
}