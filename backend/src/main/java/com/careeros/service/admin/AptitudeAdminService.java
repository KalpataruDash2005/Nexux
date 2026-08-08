package com.careeros.service.admin;

import com.careeros.dto.admin.AptitudeQuestionDto;
import com.careeros.dto.admin.AptitudeSetDto;
import com.careeros.entity.AptitudeQuestion;
import com.careeros.entity.AptitudeSet;
import com.careeros.entity.User;
import com.careeros.exception.BadRequestException;
import com.careeros.placement.dto.AptitudeParsedBatch;
import com.careeros.placement.dto.AptitudeParsedQuestion;
import com.careeros.placement.service.PlacementAiService;
import com.careeros.repository.AptitudeQuestionRepository;
import com.careeros.repository.AptitudeSetRepository;
import com.careeros.repository.UserRepository;
import com.careeros.service.TextExtractionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AptitudeAdminService {

    private final UserRepository userRepository;
    private final AptitudeSetRepository aptitudeSetRepository;
    private final AptitudeQuestionRepository aptitudeQuestionRepository;
    private final TextExtractionService textExtractionService;
    private final PlacementAiService placementAiService;
    private final ObjectMapper objectMapper;

    @Transactional
    public AptitudeSetDto uploadSet(String adminEmail, MultipartFile file, String title) {
        verifyAdmin(adminEmail);
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Please upload a PDF file.");
        }
        if (!file.getOriginalFilename().toLowerCase().endsWith(".pdf")) {
            throw new BadRequestException("Only PDF files are supported.");
        }
        String sourceTitle = (title == null || title.isBlank()) ? file.getOriginalFilename() : title.trim();

        Path temp = null;
        try {
            String ext = file.getOriginalFilename().contains(".")
                    ? file.getOriginalFilename().substring(file.getOriginalFilename().lastIndexOf('.')) : ".pdf";
            temp = Files.createTempFile("careeros-aptitude-", ext);
            file.transferTo(temp.toFile());

            String extracted = textExtractionService.extractDocument(temp, file.getOriginalFilename()).text();
            if (extracted == null || extracted.isBlank()) {
                throw new BadRequestException("Could not extract any text from the PDF.");
            }

            AptitudeParsedBatch batch = placementAiService.parseAptitudePdf(extracted);
            List<AptitudeParsedQuestion> parsed = batch == null || batch.questions() == null
                    ? List.of() : batch.questions();
            if (parsed.isEmpty()) {
                throw new BadRequestException("No aptitude questions could be identified in the PDF.");
            }

            AptitudeSet set = AptitudeSet.builder()
                    .title(sourceTitle)
                    .fileName(file.getOriginalFilename())
                    .questionCount(parsed.size())
                    .createdBy(adminEmail)
                    .build();
            set = aptitudeSetRepository.save(set);

            for (AptitudeParsedQuestion q : parsed) {
                AptitudeQuestion entity = AptitudeQuestion.builder()
                        .setId(set.getId())
                        .text(q.text())
                        .optionsJson(objectMapper.writeValueAsString(q.options() == null ? new ArrayList<>() : q.options()))
                        .correctIndex(Math.max(0, q.correctIndex()))
                        .explanation(q.explanation())
                        .difficulty(q.difficulty() == null ? "MEDIUM" : q.difficulty().toUpperCase())
                        .topic(q.topic())
                        .category(q.category() == null ? null : q.category().toUpperCase())
                        .build();
                aptitudeQuestionRepository.save(entity);
            }
            return new AptitudeSetDto(set.getId(), set.getTitle(), set.getFileName(), set.getQuestionCount(),
                    set.getCreatedBy(), set.getCreatedAt());
        } catch (BadRequestException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to process aptitude PDF upload", e);
            throw new BadRequestException("Failed to process aptitude PDF: " + e.getMessage());
        } finally {
            if (temp != null) {
                try {
                    Files.deleteIfExists(temp);
                } catch (Exception ignore) {
                }
            }
        }
    }

    public List<AptitudeSetDto> listSets(String adminEmail) {
        verifyAdmin(adminEmail);
        return aptitudeSetRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(s -> new AptitudeSetDto(s.getId(), s.getTitle(), s.getFileName(), s.getQuestionCount(),
                        s.getCreatedBy(), s.getCreatedAt()))
                .collect(Collectors.toList());
    }

    public List<AptitudeQuestionDto> listQuestions(String adminEmail, String setId) {
        verifyAdmin(adminEmail);
        if (!aptitudeSetRepository.existsById(setId)) {
            throw new BadRequestException("Aptitude set not found");
        }
        return aptitudeQuestionRepository.findBySetIdOrderByCreatedAtAsc(setId).stream()
                .map(q -> new AptitudeQuestionDto(q.getId(), q.getText(), parseOptions(q.getOptionsJson()),
                        q.getCorrectIndex(), q.getExplanation(), q.getDifficulty(), q.getTopic(), q.getCategory(),
                        q.getCreatedAt()))
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteSet(String adminEmail, String setId) {
        verifyAdmin(adminEmail);
        if (!aptitudeSetRepository.existsById(setId)) {
            throw new BadRequestException("Aptitude set not found");
        }
        aptitudeQuestionRepository.deleteBySetId(setId);
        aptitudeSetRepository.deleteById(setId);
    }

    private List<String> parseOptions(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            return objectMapper.readValue(json, objectMapper.getTypeFactory()
                    .constructCollectionType(List.class, String.class));
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private void verifyAdmin(String email) {
        User admin = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (!admin.getRole().equalsIgnoreCase("ADMIN")) {
            throw new AccessDeniedException("Unauthorized: Requires ADMIN role");
        }
    }
}