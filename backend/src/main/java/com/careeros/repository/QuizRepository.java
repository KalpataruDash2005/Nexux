package com.careeros.repository;

import com.careeros.entity.Quiz;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface QuizRepository extends JpaRepository<Quiz, String> {
    List<Quiz> findByWorkspaceIdOrderByCreatedAtDesc(String workspaceId);
}
