package com.careeros.repository;

import com.careeros.entity.Summary;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SummaryRepository extends JpaRepository<Summary, String> {
    Optional<Summary> findByDocumentIdAndType(String documentId, String type);
    List<Summary> findByDocumentId(String documentId);
}
