-- Database schema for ATS crawling system

CREATE TABLE IF NOT EXISTS ats_hosts (
    id SERIAL PRIMARY KEY,
    company VARCHAR(255),
    domain VARCHAR(255) UNIQUE NOT NULL,
    ats_type VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    discovered_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_postings (
    id SERIAL PRIMARY KEY,
    ats_host_id INTEGER REFERENCES ats_hosts(id),
    url TEXT NOT NULL,
    canonical_url TEXT,
    url_hash VARCHAR(64),
    html_hash VARCHAR(64),
    job_title VARCHAR(255),
    company VARCHAR(255),
    location VARCHAR(255),
    job_id VARCHAR(255),
    job_family VARCHAR(100),
    posting_date DATE,
    status VARCHAR(50) DEFAULT 'open',
    initial_snapshot_done BOOLEAN DEFAULT false,
    last_seen_at TIMESTAMP DEFAULT NOW(),
    discovered_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(url_hash)
);

CREATE TABLE IF NOT EXISTS job_posting_versions (
    id SERIAL PRIMARY KEY,
    job_posting_id INTEGER REFERENCES job_postings(id),
    html_hash VARCHAR(64) NOT NULL,
    job_title VARCHAR(255),
    location VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_postings_status ON job_postings(status);
CREATE INDEX IF NOT EXISTS idx_job_postings_ats_host ON job_postings(ats_host_id);
CREATE INDEX IF NOT EXISTS idx_job_postings_discovered ON job_postings(discovered_at);
CREATE INDEX IF NOT EXISTS idx_job_postings_last_seen ON job_postings(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_ats_hosts_active ON ats_hosts(is_active);
CREATE INDEX IF NOT EXISTS idx_ats_hosts_type ON ats_hosts(ats_type); 