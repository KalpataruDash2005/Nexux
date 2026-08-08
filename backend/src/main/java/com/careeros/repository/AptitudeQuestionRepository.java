package com.careeros.repository;

import com.careeros.entity.AptitudeQuestion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AptitudeQuestionRepository extends JpaRepository<AptitudeQuestion, String> {
    List<AptitudeQuestion> findBySetIdOrderByCreatedAtAsc(String setId);
    void deleteBySetId(String setId);
}