package com.careeros.service;

import com.careeros.dto.document.DocumentResponseDto;
import com.careeros.entity.Document;
import com.careeros.entity.User;
import com.careeros.entity.Workspace;
import com.careeros.exception.BadRequestException;
import com.careeros.repository.DocumentRepository;
import com.careeros.repository.UserRepository;
import com.careeros.repository.WorkspaceRepository;
import com.careeros.service.rag.RagServiceClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class DocumentService {

    private final DocumentRepository documentRepository;
    private final WorkspaceRepository workspaceRepository;
    private final UserRepository userRepository;
    private final ProcessingService processingService;
    private final RagServiceClient ragServiceClient;

    // Local storage path for uploaded files
    @Value("${app.upload-dir:./storage/documents}")
    private String uploadDir;

    public DocumentResponseDto uploadDocument(String ownerEmail, String workspaceId, MultipartFile file) {
        User owner = userRepository.findByEmail(ownerEmail)
                .orElseThrow(() -> new BadRequestException("User not found"));

        Workspace workspace = workspaceRepository.findByIdAndOwnerId(workspaceId, owner.getId())
                .orElseThrow(() -> new BadRequestException("Workspace not found or access denied"));

        if (file.isEmpty()) {
            throw new BadRequestException("Cannot upload empty file");
        }
        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            throw new BadRequestException("File exceeds the 50 MB upload limit");
        }

        try {
            // Ensure directory exists
            Path uploadPath = Paths.get(uploadDir, workspaceId);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }

            // Save file
            String originalFilename = file.getOriginalFilename();
            String safeName = sanitizeFileName(originalFilename);
            String extension = "unknown";
            if (safeName.contains(".")) {
                extension = safeName.substring(safeName.lastIndexOf("."));
            }
            String uniqueFileName = UUID.randomUUID().toString() + extension;
            Path filePath = uploadPath.resolve(uniqueFileName);
            file.transferTo(filePath.toAbsolutePath().toFile());

            // Save metadata
            Document document = Document.builder()
                    .workspace(workspace)
                    .name(safeName)
                    .type(file.getContentType() != null ? file.getContentType() : "application/octet-stream")
                    .sizeBytes(file.getSize())
                    .status(Document.Status.PROCESSING)
                    .filePath(filePath.toString())
                    .build();

            document = documentRepository.save(document);
            
            // Trigger background processing
            processingService.processDocument(document.getId());

            return mapToDto(document);

        } catch (IOException e) {
            throw new RuntimeException("Failed to store file", e);
        }
    }

    public List<DocumentResponseDto> getDocumentsByWorkspace(String ownerEmail, String workspaceId) {
        User owner = userRepository.findByEmail(ownerEmail)
                .orElseThrow(() -> new BadRequestException("User not found"));

        Workspace workspace = workspaceRepository.findByIdAndOwnerId(workspaceId, owner.getId())
                .orElseThrow(() -> new BadRequestException("Workspace not found or access denied"));

        return documentRepository.findByWorkspaceId(workspaceId).stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    public void deleteDocument(String ownerEmail, String workspaceId, String documentId) {
        User owner = userRepository.findByEmail(ownerEmail)
                .orElseThrow(() -> new BadRequestException("User not found"));

        Workspace workspace = workspaceRepository.findByIdAndOwnerId(workspaceId, owner.getId())
                .orElseThrow(() -> new BadRequestException("Workspace not found or access denied"));

        Document document = documentRepository.findByIdAndWorkspaceId(documentId, workspaceId)
                .orElseThrow(() -> new BadRequestException("Document not found in this workspace"));

        try {
            ragServiceClient.deleteDocument(workspaceId, documentId);
        } catch (Exception e) {
            log.warn("Failed to delete document from rag-service: {}", e.getMessage());
        }

        // Delete from local storage
        File file = new File(document.getFilePath());
        if (file.exists()) {
            file.delete();
        }

        // Delete from DB
        documentRepository.delete(document);
    }

    private DocumentResponseDto mapToDto(Document document) {
        return DocumentResponseDto.builder()
                .id(document.getId())
                .workspaceId(document.getWorkspace().getId())
                .name(document.getName())
                .type(document.getType())
                .sizeBytes(document.getSizeBytes())
                .status(document.getStatus().name())
                .createdAt(document.getCreatedAt())
                .updatedAt(document.getUpdatedAt())
                .build();
    }

    private static final long MAX_FILE_SIZE_BYTES = 50L * 1024 * 1024;

    /**
     * Strip path separators and control characters from a client-supplied file name so it
     * can never traverse directories or be used to craft the stored path.
     */
    static String sanitizeFileName(String originalFilename) {
        if (originalFilename == null || originalFilename.isBlank()) {
            return "Unnamed File";
        }
        String name = originalFilename
                .replaceAll("[/\\\\]", "_")
                .replaceAll("[\\p{Cntrl}]", "")
                .trim();
        return name.isEmpty() ? "Unnamed File" : name;
    }
}
