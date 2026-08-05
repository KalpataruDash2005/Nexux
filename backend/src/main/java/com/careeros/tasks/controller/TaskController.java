package com.careeros.tasks.controller;

import com.careeros.tasks.dto.*;
import com.careeros.tasks.service.TaskService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskService taskService;

    private String getCurrentUserEmail() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication.getName();
    }

    // ------------------------------------------------------------------
    // CRUD
    // ------------------------------------------------------------------

    @PostMapping
    public ResponseEntity<TaskDto> createTask(@RequestBody CreateTaskRequest request) {
        return ResponseEntity.ok(taskService.createTask(getCurrentUserEmail(), request));
    }

    @GetMapping
    public ResponseEntity<List<TaskDto>> getTasks(@RequestParam(required = false) String status) {
        return ResponseEntity.ok(taskService.getTasks(getCurrentUserEmail(), status));
    }

    @GetMapping("/{id}")
    public ResponseEntity<TaskDto> getTask(@PathVariable String id) {
        return ResponseEntity.ok(taskService.getTask(getCurrentUserEmail(), id));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<TaskDto> updateTask(@PathVariable String id, @RequestBody UpdateTaskRequest request) {
        return ResponseEntity.ok(taskService.updateTask(getCurrentUserEmail(), id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTask(@PathVariable String id) {
        taskService.deleteTask(getCurrentUserEmail(), id);
        return ResponseEntity.ok().build();
    }

    // ------------------------------------------------------------------
    // Summary / dashboard
    // ------------------------------------------------------------------

    @GetMapping("/summary")
    public ResponseEntity<TaskSummaryResponse> getSummary() {
        return ResponseEntity.ok(taskService.getSummary(getCurrentUserEmail()));
    }

    // ------------------------------------------------------------------
    // AI planner
    // ------------------------------------------------------------------

    @PostMapping("/ai-plan")
    public ResponseEntity<AiPlanResponse> generateAiPlan() {
        return ResponseEntity.ok(taskService.generateAiPlan(getCurrentUserEmail()));
    }
}
