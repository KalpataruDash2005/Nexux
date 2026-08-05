package com.careeros.placement.repository;

import com.careeros.placement.entity.PlacementResumeAnalysis;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PlacementResumeAnalysisRepository extends JpaRepository<PlacementResumeAnalysis, String> {

    Optional<PlacementResumeAnalysis> findTopByResumeIdOrderByCreatedAtDesc(String resumeId);

    Optional<PlacementResumeAnalysis> findTopByOwnerIdOrderByCreatedAtDesc(String ownerId);
}
