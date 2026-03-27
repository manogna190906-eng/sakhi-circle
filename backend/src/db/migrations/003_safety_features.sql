-- Migration 003: Safety features
-- Content filter log, emergency resources, AI moderation score column

-- Track every content filter decision for audit and ML training
CREATE TABLE content_filter_log (
  log_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type VARCHAR(10) NOT NULL CHECK (content_type IN ('post','comment','message')),
  content_id   UUID NOT NULL,
  user_id      UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  raw_text     TEXT NOT NULL,
  decision     VARCHAR(10) NOT NULL CHECK (decision IN ('allow','hold','block')),
  method       VARCHAR(10) NOT NULL CHECK (method IN ('terms','ai','combined')),
  ai_score     NUMERIC(4,3),   -- 0.000–1.000, null if AI not used
  matched_term TEXT,           -- which prohibited term triggered (if any)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Configurable prohibited terms list (hot-reloadable)
CREATE TABLE prohibited_terms (
  term_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term       TEXT NOT NULL UNIQUE,
  added_by   UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed with a minimal starter list
INSERT INTO prohibited_terms (term) VALUES
  ('kill yourself'), ('kys'), ('you deserve to die'),
  ('nobody cares about you'), ('go die');

-- Emergency help resources (admin-managed)
CREATE TABLE help_resources (
  resource_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        VARCHAR(200) NOT NULL,
  description  TEXT,
  phone        VARCHAR(30),
  url          TEXT,
  category     VARCHAR(50) NOT NULL CHECK (category IN ('crisis','mental_health','safety','legal','medical')),
  country_code VARCHAR(5) NOT NULL DEFAULT 'IN',
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order   INT NOT NULL DEFAULT 0
);

-- Seed with India-specific resources
INSERT INTO help_resources (title, description, phone, url, category, sort_order) VALUES
  ('iCall', 'Psychosocial helpline by TISS', '9152987821', 'https://icallhelpline.org', 'mental_health', 1),
  ('Vandrevala Foundation', '24/7 mental health helpline', '1860-2662-345', 'https://www.vandrevalafoundation.com', 'crisis', 2),
  ('National Commission for Women', 'Women safety helpline', '7827170170', 'https://ncw.nic.in', 'safety', 3),
  ('Women Helpline (WHL)', 'All-India women distress helpline', '181', NULL, 'safety', 4),
  ('Snehi', 'Emotional support helpline', '044-24640050', 'https://snehi.org', 'mental_health', 5),
  ('iDream', 'Legal aid for women', NULL, 'https://idream.org.in', 'legal', 6);

-- Add priority flag to reports for auto-escalation tracking
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS priority VARCHAR(10) NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('normal','high'));

-- Add AI score to posts/comments for moderation queue sorting
ALTER TABLE posts    ADD COLUMN IF NOT EXISTS ai_risk_score NUMERIC(4,3);
ALTER TABLE comments ADD COLUMN IF NOT EXISTS ai_risk_score NUMERIC(4,3);

-- Index for fast filter log queries
CREATE INDEX idx_filter_log_content ON content_filter_log(content_type, content_id);
CREATE INDEX idx_filter_log_user    ON content_filter_log(user_id);
CREATE INDEX idx_help_resources_cat ON help_resources(category, active);
