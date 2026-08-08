-- Convert MySQL LONGTEXT columns to TEXT so the schema matches the JPA entities
-- (entities now declare columnDefinition = "TEXT", which is PostgreSQL-compatible).
-- TEXT in MySQL holds up to 64KB, sufficient for resume text / analysis JSON.
ALTER TABLE placement_resumes MODIFY COLUMN text TEXT;
ALTER TABLE placement_resume_analyses MODIFY COLUMN analysis_json TEXT NOT NULL;
ALTER TABLE placement_sessions MODIFY COLUMN payload_json TEXT;
ALTER TABLE placement_messages MODIFY COLUMN content TEXT NOT NULL;
ALTER TABLE placement_messages MODIFY COLUMN analysis_json TEXT;
