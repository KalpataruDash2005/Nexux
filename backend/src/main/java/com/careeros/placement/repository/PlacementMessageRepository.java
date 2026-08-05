package com.careeros.placement.repository;

import com.careeros.placement.entity.PlacementMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface PlacementMessageRepository extends JpaRepository<PlacementMessage, String> {

    List<PlacementMessage> findBySessionIdOrderByCreatedAtAsc(String sessionId);

    long countBySessionId(String sessionId);

    long countByOwnerIdAndRole(String ownerId, String role);

    long countByOwnerIdAndRoleAndCreatedAtGreaterThanEqual(String ownerId, String role, LocalDateTime from);
}
