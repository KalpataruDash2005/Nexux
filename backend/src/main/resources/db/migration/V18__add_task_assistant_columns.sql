ALTER TABLE tasks
    ADD COLUMN progress_notes TEXT NULL AFTER status,
    ADD COLUMN parent_task_id VARCHAR(36) NULL AFTER progress_notes,
    ADD CONSTRAINT fk_tasks_parent_task FOREIGN KEY (parent_task_id) REFERENCES tasks (id) ON DELETE CASCADE;
