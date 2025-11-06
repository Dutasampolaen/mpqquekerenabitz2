-- PostgreSQL schema (DDL) untuk MPK System (ringkas)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Members
CREATE TABLE IF NOT EXISTS members (
  id              BIGSERIAL PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  org_unit        TEXT,                      -- Bidang bebas: Sekbid 1, Komisi A, dll
  total_done      INT DEFAULT 0,
  last_comment    TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Proposals
CREATE TABLE IF NOT EXISTS proposals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  division        TEXT,
  uploader        TEXT,
  start_dt        TIMESTAMPTZ,
  end_dt          TIMESTAMPTZ,
  location        TEXT,
  link            TEXT,
  file_path       TEXT,
  status          TEXT NOT NULL DEFAULT 'SUBMITTED',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_time CHECK (end_dt IS NULL OR start_dt IS NULL OR end_dt > start_dt)
);

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS period tstzrange GENERATED ALWAYS AS (CASE
    WHEN start_dt IS NOT NULL AND end_dt IS NOT NULL THEN tstzrange(start_dt, end_dt, '[]')
    ELSE NULL
  END) STORED;

CREATE INDEX IF NOT EXISTS idx_proposals_period_gist ON proposals USING gist (period);

-- Assignments (panitia final)
CREATE TABLE IF NOT EXISTS proposal_members (
  id              BIGSERIAL PRIMARY KEY,
  proposal_id     UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  member_id       BIGINT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  role            TEXT NOT NULL DEFAULT 'Anggota',
  committee_field TEXT,                       -- Bidang pada saat proker
  override_reason TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS unq_pm_proposal_member ON proposal_members(proposal_id, member_id);

-- Evaluasi (revisi)
CREATE TABLE IF NOT EXISTS evaluations (
  id              BIGSERIAL PRIMARY KEY,
  proposal_id     UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  revision        INT NOT NULL,
  evaluator       TEXT NOT NULL,
  total           NUMERIC(5,2) NOT NULL,
  penalty         INT NOT NULL DEFAULT 0,
  final           NUMERIC(5,2) NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (proposal_id, revision)
);

CREATE TABLE IF NOT EXISTS evaluation_items (
  id              BIGSERIAL PRIMARY KEY,
  evaluation_id   BIGINT NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  item_no         INT NOT NULL CHECK (item_no BETWEEN 1 AND 27),
  score           INT NOT NULL CHECK (score BETWEEN 0 AND 100),
  comment         TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS unq_eval_item ON evaluation_items(evaluation_id, item_no);

-- Notifikasi
CREATE TABLE IF NOT EXISTS notifications (
  id              BIGSERIAL PRIMARY KEY,
  type            TEXT NOT NULL, -- 'PROPOSAL','OVERWORK','SCHEDULE','MIN_MEMBERS'
  message         TEXT NOT NULL,
  proposal_id     UUID,
  member_id       BIGINT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  read_at         TIMESTAMPTZ
);

-- Calon panitia (opsional)
CREATE TABLE IF NOT EXISTS proposal_candidates (
  id              BIGSERIAL PRIMARY KEY,
  proposal_id     UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  member_id       BIGINT REFERENCES members(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  nim             TEXT,
  role            TEXT NOT NULL DEFAULT 'Anggota',
  committee_field TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS unq_candidate ON proposal_candidates(proposal_id, COALESCE(member_id,0), COALESCE(nim,''), lower(name));

-- Rules (key-value)
CREATE TABLE IF NOT EXISTS rules_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT INTO rules_config(key, value) VALUES
  ('cooldown_days','14'),
  ('default_max_proker','2')
ON CONFLICT (key) DO NOTHING;

-- Statistik anggota (view)
DROP MATERIALIZED VIEW IF EXISTS member_stats;
CREATE MATERIALIZED VIEW member_stats AS
WITH ordered AS (
  SELECT
    m.id AS member_id,
    m.name,
    pm.proposal_id,
    p.start_dt,
    p.end_dt,
    LAG(p.end_dt) OVER (PARTITION BY m.id ORDER BY p.start_dt) AS prev_end
  FROM members m
  JOIN proposal_members pm ON pm.member_id = m.id
  JOIN proposals p ON p.id = pm.proposal_id
),
gaps AS (
  SELECT *,
    CASE WHEN prev_end IS NULL THEN NULL
         ELSE EXTRACT(EPOCH FROM (start_dt - prev_end))/86400::numeric END AS gap_days
  FROM ordered
)
SELECT
  member_id,
  name,
  COUNT(*) FILTER (WHERE end_dt < now())::int        AS total_done,
  MIN(gap_days)  FILTER (WHERE gap_days IS NOT NULL) AS min_gap_days,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY gap_days) FILTER (WHERE gap_days IS NOT NULL) AS median_gap_days,
  AVG(gap_days)  FILTER (WHERE gap_days IS NOT NULL) AS avg_gap_days,
  MAX(end_dt)                                          AS last_end_dt
FROM gaps
GROUP BY member_id, name;
