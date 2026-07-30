package com.careeros.repository;

import com.careeros.entity.Application;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ApplicationRepository extends JpaRepository<Application, String> {
    List<Application> findByStudentIdOrderByCreatedAtDesc(String studentId);
    List<Application> findByJobIdOrderByCreatedAtDesc(String jobId);
    Optional<Application> findByJobIdAndStudentId(String jobId, String studentId);
}
