package com.careeros.tasks.repository;

import com.careeros.tasks.entity.AiConversation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface AiConversationRepository extends JpaRepository<AiConversation, String> {

    List<AiConversation> findTop20ByUserIdOrderByCreatedAtDesc(String userId);

    @Query("SELECT c FROM AiConversation c WHERE c.user.id = :userId ORDER BY c.createdAt DESC")
    List<AiConversation> findRecentByUserId(@Param("userId") String userId, org.springframework.data.domain.Pageable pageable);
}
