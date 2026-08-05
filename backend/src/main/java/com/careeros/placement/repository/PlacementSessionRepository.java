package com.careeros.placement.repository;

import com.careeros.placement.entity.PlacementSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface PlacementSessionRepository extends JpaRepository<PlacementSession, String> {

    List<PlacementSession> findByOwnerIdOrderByCreatedAtDesc(String ownerId);

    List<PlacementSession> findByOwnerIdAndCreatedAtGreaterThanEqualOrderByCreatedAtAsc(
            String ownerId, LocalDateTime from);

    List<PlacementSession> findByOwnerIdAndStatusOrderByCreatedAtDesc(String ownerId, String status);

    List<PlacementSession> findByOwnerIdAndTypeInOrderByCreatedAtDesc(String ownerId, Collection<String> types);

    List<PlacementSession> findByOwnerIdAndStatusAndTypeInOrderByCreatedAtDesc(
            String ownerId, String status, Collection<String> types);

    Optional<PlacementSession> findByIdAndOwnerId(String id, String ownerId);
}
