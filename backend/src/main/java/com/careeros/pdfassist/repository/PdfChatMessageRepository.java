package com.careeros.pdfassist.repository;

import com.careeros.pdfassist.entity.PdfChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PdfChatMessageRepository extends JpaRepository<PdfChatMessage, String> {
    List<PdfChatMessage> findByDocumentIdOrderByCreatedAtAsc(String documentId);
}
