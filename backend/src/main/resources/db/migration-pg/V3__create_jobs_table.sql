CREATE TABLE jobs (
    id VARCHAR(36) NOT NULL,
    posted_by_id VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    location VARCHAR(255),
    salary VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    CONSTRAINT pk_jobs PRIMARY KEY (id),
    CONSTRAINT fk_jobs_user FOREIGN KEY (posted_by_id) REFERENCES users(id) ON DELETE CASCADE
);
