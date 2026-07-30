package com.careeros.repository;

import com.careeros.entity.Job;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface JobRepository extends JpaRepository<Job, String> {
    List<Job> findByStatusOrderByCreatedAtDesc(String status);
    
    @org.springframework.data.jpa.repository.Query("SELECT j FROM Job j WHERE j.status = :status AND (" +
            "LOWER(j.title) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
            "LOWER(j.companyName) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
            "LOWER(j.location) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    List<Job> searchActiveJobs(String status, String keyword);
}
