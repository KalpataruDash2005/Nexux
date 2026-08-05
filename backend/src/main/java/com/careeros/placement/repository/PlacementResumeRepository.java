package com.careeros.placement.repository;

import com.careeros.placement.entity.PlacementResume;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PlacementResumeRepository extends JpaRepository<PlacementResume, String> {

    List<PlacementResume> findByOwnerIdOrderByCreatedAtDesc(String ownerId);

    Optional<PlacementResume> findByIdAndOwnerId(String id, String ownerId);
}
