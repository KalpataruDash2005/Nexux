package com.careeros.repository;

import com.careeros.entity.AptitudeSet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AptitudeSetRepository extends JpaRepository<AptitudeSet, String> {
    List<AptitudeSet> findAllByOrderByCreatedAtDesc();
}