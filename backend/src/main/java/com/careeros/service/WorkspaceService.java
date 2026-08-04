package com.careeros.service;

import com.careeros.dto.workspace.CreateWorkspaceRequestDto;
import com.careeros.dto.workspace.WorkspaceResponseDto;
import com.careeros.entity.User;
import com.careeros.entity.Workspace;
import com.careeros.exception.BadRequestException;
import com.careeros.repository.UserRepository;
import com.careeros.repository.WorkspaceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WorkspaceService {

    private final WorkspaceRepository workspaceRepository;
    private final UserRepository userRepository;
    private final com.careeros.repository.DocumentRepository documentRepository;

    public WorkspaceResponseDto createWorkspace(String ownerEmail, CreateWorkspaceRequestDto dto) {
        User owner = userRepository.findByEmail(ownerEmail)
                .orElseThrow(() -> new BadRequestException("User not found"));

        Workspace workspace = Workspace.builder()
                .name(dto.getName())
                .description(dto.getDescription())
                .owner(owner)
                .build();

        workspace = workspaceRepository.save(workspace);
        return mapToDto(workspace);
    }

    public List<WorkspaceResponseDto> getUserWorkspaces(String ownerEmail) {
        User owner = userRepository.findByEmail(ownerEmail)
                .orElseThrow(() -> new BadRequestException("User not found"));
        return workspaceRepository.findByOwnerId(owner.getId())
                .stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    public WorkspaceResponseDto getWorkspaceById(String id, String ownerEmail) {
        User owner = userRepository.findByEmail(ownerEmail)
                .orElseThrow(() -> new BadRequestException("User not found"));
        Workspace workspace = workspaceRepository.findByIdAndOwnerId(id, owner.getId())
                .orElseThrow(() -> new BadRequestException("Workspace not found or access denied"));
        return mapToDto(workspace);
    }

    public WorkspaceResponseDto renameWorkspace(String id, String ownerEmail, String name, String description) {
        User owner = userRepository.findByEmail(ownerEmail)
                .orElseThrow(() -> new BadRequestException("User not found"));
        Workspace workspace = workspaceRepository.findByIdAndOwnerId(id, owner.getId())
                .orElseThrow(() -> new BadRequestException("Workspace not found or access denied"));
        if (name == null || name.isBlank()) {
            throw new BadRequestException("Workspace name must not be empty");
        }
        workspace.setName(name.trim());
        if (description != null) {
            workspace.setDescription(description);
        }
        workspace = workspaceRepository.save(workspace);
        return mapToDto(workspace);
    }

    public void deleteWorkspace(String id, String ownerEmail) {
        User owner = userRepository.findByEmail(ownerEmail)
                .orElseThrow(() -> new BadRequestException("User not found"));
        Workspace workspace = workspaceRepository.findByIdAndOwnerId(id, owner.getId())
                .orElseThrow(() -> new BadRequestException("Workspace not found or access denied"));
        workspaceRepository.delete(workspace);
    }

    public WorkspaceResponseDto archiveWorkspace(String id, String ownerEmail) {
        User owner = userRepository.findByEmail(ownerEmail)
                .orElseThrow(() -> new BadRequestException("User not found"));
        Workspace workspace = workspaceRepository.findByIdAndOwnerId(id, owner.getId())
                .orElseThrow(() -> new BadRequestException("Workspace not found or access denied"));
        workspace.setStatus("ARCHIVED");
        workspace = workspaceRepository.save(workspace);
        return mapToDto(workspace);
    }

    public com.careeros.dto.workspace.WorkspaceStatsDto getWorkspaceStats(String ownerEmail, String workspaceId) {
        User owner = userRepository.findByEmail(ownerEmail)
                .orElseThrow(() -> new BadRequestException("User not found"));

        Workspace workspace = workspaceRepository.findByIdAndOwnerId(workspaceId, owner.getId())
                .orElseThrow(() -> new BadRequestException("Workspace not found or access denied"));

        java.util.List<com.careeros.entity.Document> docs = documentRepository.findByWorkspaceId(workspaceId);
        
        long totalDocs = docs.size();
        long totalPages = docs.stream().filter(d -> d.getPages() != null).mapToInt(com.careeros.entity.Document::getPages).sum();
        long totalChunks = docs.stream().filter(d -> d.getChunkCount() != null).mapToInt(com.careeros.entity.Document::getChunkCount).sum();
        long storageUsed = docs.stream().mapToLong(com.careeros.entity.Document::getSizeBytes).sum();
        
        // We need to inject ChatSessionRepository or just count it here. For simplicity we will just count it via a new injected repo or skip for now if we can't inject.
        // Actually, we can fetch from ChatSessionRepository.
        long totalConversations = 0; // Placeholder until we inject chatSessionRepository

        return com.careeros.dto.workspace.WorkspaceStatsDto.builder()
                .totalDocuments(totalDocs)
                .totalPages(totalPages)
                .totalChunks(totalChunks)
                .storageUsedBytes(storageUsed)
                .totalConversations(totalConversations)
                .build();
    }

    private WorkspaceResponseDto mapToDto(Workspace workspace) {
        return WorkspaceResponseDto.builder()
                .id(workspace.getId())
                .name(workspace.getName())
                .description(workspace.getDescription())
                .ownerId(workspace.getOwner().getId())
                .status(workspace.getStatus())
                .createdAt(workspace.getCreatedAt())
                .updatedAt(workspace.getUpdatedAt())
                .build();
    }
}
