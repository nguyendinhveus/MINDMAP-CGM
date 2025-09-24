package com.example.backend.controller;

import com.example.backend.dto.MindmapDto;
import com.example.backend.model.Mindmap;
import com.example.backend.model.Node;
import com.example.backend.model.User;
import com.example.backend.repository.MindmapRepository;
import com.example.backend.repository.NodeRepository;
import com.example.backend.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/mindmaps")
public class MindmapController {
    private final MindmapRepository mindmapRepository;
    private final NodeRepository nodeRepository;
    private final UserRepository userRepository;

    public MindmapController(MindmapRepository mindmapRepository, NodeRepository nodeRepository, UserRepository userRepository) {
        this.mindmapRepository = mindmapRepository;
        this.nodeRepository = nodeRepository;
        this.userRepository = userRepository;
    }

    // helper: get or create user from JWT principal
    private User getOrCreateUser(Jwt jwt) {
        if (jwt == null) return null;

        // Cognito có thể trả về username (vd: google_xxx) hoặc chỉ sub
        String username = jwt.getClaimAsString("username");
        if (username == null || username.isBlank()) {
            username = jwt.getClaimAsString("sub");
        }

        if (username == null) return null;

        // Lưu username/sub này vào cột email để tái sử dụng
        String finalUsername = username;
        return userRepository.findByEmail(finalUsername)
                .orElseGet(() -> {
                    User u = new User();
                    u.setEmail(finalUsername);
                    u.setPasswordHash("external"); // chỉ để tránh null, không dùng password
                    return userRepository.save(u);
                });
    }

    @GetMapping
    public ResponseEntity<?> listMindmaps(@AuthenticationPrincipal Jwt jwt) {
        User user = getOrCreateUser(jwt);
        if (user == null) return ResponseEntity.status(401).body("unauthorized");
        List<Mindmap> list = mindmapRepository.findAllByUserOrderByUpdatedAtDesc(user);
        List<MindmapDto.MindmapCardDto> cards = list.stream().map(m -> {
            MindmapDto.MindmapCardDto c = new MindmapDto.MindmapCardDto();
            c.id = m.getId();
            c.name = m.getName();
            c.updatedAt = m.getUpdatedAt();
            return c;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(cards);
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> createMindmap(@AuthenticationPrincipal Jwt jwt,
                                           @RequestBody MindmapDto.CreateRequest req) {
        User user = getOrCreateUser(jwt);
        if (user == null) return ResponseEntity.status(401).body("unauthorized");
        if (req.name == null || req.name.isBlank()) return ResponseEntity.badRequest().body("name required");

        Mindmap m = new Mindmap();
        m.setName(req.name);
        m.setUser(user);
        Mindmap saved = mindmapRepository.save(m);

        Node root = new Node();
        root.setMindmap(saved);
        root.setContent("Root");
        root.setPositionX(0.0);
        root.setPositionY(0.0);
        root.setRadius(50);
        Node savedRoot = nodeRepository.save(root);

        saved.setRootNode(savedRoot);
        mindmapRepository.save(saved);

        Map<String, Object> resp = Map.of(
                "id", saved.getId(),
                "name", saved.getName(),
                "rootNodeId", savedRoot.getId()
        );
        return ResponseEntity.ok(resp);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getMindmap(@AuthenticationPrincipal Jwt jwt,
                                        @PathVariable Long id) {
        User user = getOrCreateUser(jwt);
        if (user == null) return ResponseEntity.status(401).body("unauthorized");
        Optional<Mindmap> mOpt = mindmapRepository.findById(id);
        if (mOpt.isEmpty()) return ResponseEntity.status(404).body("not found");
        Mindmap m = mOpt.get();
        if (!m.getUser().getId().equals(user.getId())) return ResponseEntity.status(403).body("forbidden");

        List<Node> nodes = nodeRepository.findAll().stream()
                .filter(n -> n.getMindmap().getId().equals(m.getId()))
                .collect(Collectors.toList());

        MindmapDto.MindmapFullDto full = new MindmapDto.MindmapFullDto();
        full.id = m.getId();
        full.name = m.getName();
        full.nodes = nodes.stream().map(n -> {
            MindmapDto.NodeDto nd = new MindmapDto.NodeDto();
            nd.id = n.getId();
            nd.parentId = n.getParent() != null ? n.getParent().getId() : null;
            nd.content = n.getContent();
            nd.positionX = n.getPositionX();
            nd.positionY = n.getPositionY();
            nd.radius = n.getRadius();
            return nd;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(full);
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<?> updateMindmap(@AuthenticationPrincipal Jwt jwt,
                                           @PathVariable Long id,
                                           @RequestBody MindmapDto.UpdateRequest req) {
        User user = getOrCreateUser(jwt);
        if (user == null) return ResponseEntity.status(401).body("unauthorized");
        Optional<Mindmap> mOpt = mindmapRepository.findById(id);
        if (mOpt.isEmpty()) return ResponseEntity.status(404).body("not found");
        Mindmap m = mOpt.get();
        if (!m.getUser().getId().equals(user.getId())) return ResponseEntity.status(403).body("forbidden");

        m.setName(req.name);
        m.setUpdatedAt(Instant.now()); // Cập nhật thời gian (sử dụng java.time.Instant)
        mindmapRepository.save(m);
        return ResponseEntity.ok(Map.of("id", m.getId(), "name", m.getName(), "updatedAt", m.getUpdatedAt()));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> deleteMindmap(@AuthenticationPrincipal Jwt jwt,
                                           @PathVariable Long id) {
        User user = getOrCreateUser(jwt);
        if (user == null) return ResponseEntity.status(401).body("unauthorized");
        Optional<Mindmap> mOpt = mindmapRepository.findById(id);
        if (mOpt.isEmpty()) return ResponseEntity.status(404).body("not found");
        Mindmap m = mOpt.get();
        if (!m.getUser().getId().equals(user.getId())) return ResponseEntity.status(403).body("forbidden");

        nodeRepository.deleteByMindmap(m); // Xóa các node liên quan
        mindmapRepository.delete(m);
        return ResponseEntity.ok(Map.of("message", "Mindmap deleted"));
    }
}
