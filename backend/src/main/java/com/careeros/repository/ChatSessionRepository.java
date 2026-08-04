package com.careeros.repository;

import com.careeros.entity.ChatSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChatSessionRepository extends JpaRepository<ChatSession, String> {
    List<ChatSession> findByWorkspaceIdOrderByCreatedAtDesc(String workspaceId);
    Optional<ChatSession> findByIdAndWorkspaceId(String id, String workspaceId);
}
