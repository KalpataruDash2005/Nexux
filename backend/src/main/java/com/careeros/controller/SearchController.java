package com.careeros.controller;

import com.careeros.service.SemanticSearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/search")
@RequiredArgsConstructor
public class SearchController {

    private final SemanticSearchService searchService;

    @GetMapping
    public ResponseEntity<List<SemanticSearchService.SearchResultDto>> search(
            @PathVariable String workspaceId,
            @RequestParam String query,
            @RequestParam(value = "maxResults", defaultValue = "10") int maxResults) {
        
        return ResponseEntity.ok(searchService.search(workspaceId, query, maxResults));
    }
}
