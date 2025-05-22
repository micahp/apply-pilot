-- SERIAL is deprecated -> use identity columns
CREATE TABLE ats_hosts (
  id           BIGSERIAL PRIMARY KEY,
  domain       TEXT NOT NULL UNIQUE,
  company      TEXT,
  ats_type     TEXT NOT NULL,
  is_active    BOOLEAN DEFAULT TRUE,
  discovered_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE job_status AS ENUM ('open','closed');

CREATE TABLE job_postings (
  id              BIGSERIAL PRIMARY KEY,
  ats_host_id     BIGINT REFERENCES ats_hosts(id),
  url             TEXT NOT NULL,
  canonical_url   TEXT NOT NULL,
  html_hash       CHAR(64) NOT NULL,
  company         TEXT NOT NULL,
  job_id          TEXT,
  job_title       TEXT,
  location        TEXT,
  posting_date    DATE,
  job_family      TEXT NOT NULL DEFAULT 'Unknown',
  status          job_status NOT NULL DEFAULT 'open',
  discovered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company, job_id),
  UNIQUE (canonical_url)
);

CREATE TABLE job_posting_versions (
  id               BIGSERIAL PRIMARY KEY,
  job_posting_id   BIGINT REFERENCES job_postings(id) ON DELETE CASCADE,
  html_hash        CHAR(64) NOT NULL,
  snapshot_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Helpful indexes
CREATE INDEX idx_postings_company_title_loc_dt
  ON job_postings(company, job_title, location, posting_date);
CREATE INDEX idx_postings_family_date
  ON job_postings(job_family, posting_date);
