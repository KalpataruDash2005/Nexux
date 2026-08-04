package com.careeros.controller;

import com.careeros.dto.workspace.CreateWorkspaceRequestDto;
import com.careeros.dto.workspace.WorkspaceResponseDto;
import com.careeros.service.WorkspaceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/workspaces")
@RequiredArgsConstructor
public class WorkspaceController {

    private final WorkspaceService workspaceService;

    private String getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication.getName();
    }

    @PostMapping
    public ResponseEntity<WorkspaceResponseDto> createWorkspace(@RequestBody CreateWorkspaceRequestDto request) {
        return ResponseEntity.ok(workspaceService.createWorkspace(getCurrentUserId(), request));
    }

    @GetMapping
    public ResponseEntity<List<WorkspaceResponseDto>> getWorkspaces() {
        return ResponseEntity.ok(workspaceService.getUserWorkspaces(getCurrentUserId()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<WorkspaceResponseDto> getWorkspace(@PathVariable String id) {
        return ResponseEntity.ok(workspaceService.getWorkspaceById(id, getCurrentUserId()));
    }

    @PatchMapping("/{id}/archive")
    public ResponseEntity<WorkspaceResponseDto> archiveWorkspace(@PathVariable String id) {
        return ResponseEntity.ok(workspaceService.archiveWorkspace(id, getCurrentUserId()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteWorkspace(@PathVariable String id) {
        workspaceService.deleteWorkspace(id, getCurrentUserId());
        return ResponseEntity.ok().build();
    }

    @PatchMapping("/{id}")
    public ResponseEntity<WorkspaceResponseDto> renameWorkspace(@PathVariable String id,
                                                                @RequestBody com.careeros.dto.workspace.RenameWorkspaceRequestDto request) {
        return ResponseEntity.ok(workspaceService.renameWorkspace(
                id, getCurrentUserId(), request.getName(), request.getDescription()));
    }

    @GetMapping("/{workspaceId}/stats")
    public ResponseEntity<com.careeros.dto.workspace.WorkspaceStatsDto> getStats(@PathVariable String workspaceId) {
        // getCurrentUserId() returns the email based on our SecurityConfig
        return ResponseEntity.ok(workspaceService.getWorkspaceStats(getCurrentUserId(), workspaceId));
    }
}
