ALTER TABLE tasks
    ADD COLUMN progress_notes TEXT NULL,
    ADD COLUMN parent_task_id VARCHAR(36) NULL,
    ADD CONSTRAINT fk_tasks_parent_task FOREIGN KEY (parent_task_id) REFERENCES tasks (id) ON DELETE CASCADE;
