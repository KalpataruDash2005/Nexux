package com.careeros.repository;

import com.careeros.entity.Document;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DocumentRepository extends JpaRepository<Document, String> {
    List<Document> findByWorkspaceId(String workspaceId);
    Optional<Document> findByIdAndWorkspaceId(String id, String workspaceId);
}
