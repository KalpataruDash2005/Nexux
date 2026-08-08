package com.careeros.controller;

import com.careeros.dto.admin.AptitudeQuestionDto;
import com.careeros.dto.admin.AptitudeSetDto;
import com.careeros.service.admin.AptitudeAdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/aptitude")
@RequiredArgsConstructor
public class AptitudeAdminController {

    private final AptitudeAdminService aptitudeAdminService;

    @PostMapping("/sets")
    public ResponseEntity<AptitudeSetDto> uploadSet(Authentication authentication,
                                                    @RequestParam("file") MultipartFile file,
                                                    @RequestParam(value = "title", required = false) String title) {
        return ResponseEntity.ok(aptitudeAdminService.uploadSet(authentication.getName(), file, title));
    }

    @GetMapping("/sets")
    public ResponseEntity<List<AptitudeSetDto>> listSets(Authentication authentication) {
        return ResponseEntity.ok(aptitudeAdminService.listSets(authentication.getName()));
    }

    @GetMapping("/sets/{setId}/questions")
    public ResponseEntity<List<AptitudeQuestionDto>> listQuestions(Authentication authentication,
                                                                   @PathVariable String setId) {
        return ResponseEntity.ok(aptitudeAdminService.listQuestions(authentication.getName(), setId));
    }

    @DeleteMapping("/sets/{setId}")
    public ResponseEntity<Void> deleteSet(Authentication authentication, @PathVariable String setId) {
        aptitudeAdminService.deleteSet(authentication.getName(), setId);
        return ResponseEntity.noContent().build();
    }
}