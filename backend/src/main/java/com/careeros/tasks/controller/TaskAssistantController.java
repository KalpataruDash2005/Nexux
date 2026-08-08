package com.careeros.tasks.controller;

import com.careeros.tasks.dto.AssistantContextResponse;
import com.careeros.tasks.dto.AssistantHistoryResponse;
import com.careeros.tasks.dto.AssistantRequest;
import com.careeros.tasks.dto.AssistantResponse;
import com.careeros.tasks.service.TaskAssistantService;
import com.careeros.tasks.service.TaskContextService;
import com.careeros.tasks.service.TaskMemoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/tasks/assistant")
@RequiredArgsConstructor
public class TaskAssistantController {

    private final TaskAssistantService taskAssistantService;
    private final TaskContextService taskContextService;
    private final TaskMemoryService taskMemoryService;

    /**
     * Receives the user's natural-language instruction (typed or transcribed voice),
     * asks the LLM for structured output, then executes the update + chunking in the DB.
     */
    @PostMapping
    public ResponseEntity<AssistantResponse> handle(@RequestBody AssistantRequest request) {
        return ResponseEntity.ok(taskAssistantService.handle(request));
    }

    /**
     * Returns a compact snapshot of the current user's task context for the assistant UI:
     * active task, recent tasks, upcoming deadlines, memory, and a short conversation summary.
     */
    @GetMapping("/context")
    public ResponseEntity<AssistantContextResponse> getContext(@RequestParam(required = false) String taskId,
                                                               @RequestParam(required = false) String pageContext,
                                                               @RequestParam(required = false) String timezone) {
        return ResponseEntity.ok(taskContextService.buildContext(getCurrentUserEmail(), taskId, pageContext, timezone));
    }

    /**
     * Returns the most recent assistant conversation messages, oldest-first.
     */
    @GetMapping("/history")
    public ResponseEntity<AssistantHistoryResponse> getHistory(@RequestParam(defaultValue = "20") int limit) {
        int clamped = Math.max(1, Math.min(limit, 50));
        return ResponseEntity.ok(new AssistantHistoryResponse(taskMemoryService.history(getCurrentUserEmail(), clamped)));
    }

    private String getCurrentUserEmail() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication.getName();
    }
}
