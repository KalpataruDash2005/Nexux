package com.careeros.tasks.repository;

import com.careeros.tasks.entity.Task;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface TaskRepository extends JpaRepository<Task, String> {

    List<Task> findByUserIdOrderByDeadlineAscCreatedAtAsc(String userId);

    List<Task> findByUserIdAndStatusOrderByDeadlineAscCreatedAtAsc(String userId, String status);

    List<Task> findByUserIdAndStatusAndDeadlineLessThan(String userId, String status, LocalDateTime deadline);

    Optional<Task> findByIdAndUserId(String id, String userId);

    List<Task> findByParentTaskIdOrderByDeadlineAscCreatedAtAsc(String parentTaskId);

    long countByUserId(String userId);

    long countByUserIdAndStatus(String userId, String status);

    List<Task> findTop10ByUserIdOrderByDeadlineAscCreatedAtAsc(String userId);

    List<Task> findByUserIdAndStatusAndDeadlineGreaterThanOrderByDeadlineAsc(String userId, String status, LocalDateTime from);

    List<Task> findByUserIdAndDeadlineIsNotNullAndDeadlineBetweenOrderByDeadlineAsc(String userId, LocalDateTime from, LocalDateTime to);
}
