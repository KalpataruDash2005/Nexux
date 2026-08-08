package com.careeros.tasks.repository;

import com.careeros.tasks.entity.AiMemory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AiMemoryRepository extends JpaRepository<AiMemory, String> {

    Optional<AiMemory> findByUserIdAndKey(String userId, String key);

    List<AiMemory> findByUserId(String userId);
}
