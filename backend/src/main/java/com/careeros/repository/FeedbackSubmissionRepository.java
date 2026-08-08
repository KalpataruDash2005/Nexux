package com.careeros.repository;

import com.careeros.entity.FeedbackSubmission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FeedbackSubmissionRepository extends JpaRepository<FeedbackSubmission, String> {
    List<FeedbackSubmission> findAllByOrderByCreatedAtDesc();
}