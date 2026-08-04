package com.careeros.pdfassist.repository;

import com.careeros.pdfassist.entity.PdfDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PdfDocumentRepository extends JpaRepository<PdfDocument, String> {
    List<PdfDocument> findByWorkspaceIdAndOwnerIdOrderByCreatedAtDesc(String workspaceId, String ownerId);

    List<PdfDocument> findByWorkspaceId(String workspaceId);
}
