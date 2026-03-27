-- Migration 002: Engagement features
-- Badges, encouragement quotes, and extended notifications

-- Badge definitions per user
CREATE TABLE badges (
  badge_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  type       VARCHAR(20) NOT NULL CHECK (type IN ('supporter','mentor','listener')),
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, type)   -- one of each badge type per user
);

-- Daily encouragement quotes (admin-managed pool)
CREATE TABLE encouragement_quotes (
  quote_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text     TEXT NOT NULL,
  author   VARCHAR(200),
  active   BOOLEAN NOT NULL DEFAULT TRUE
);

-- Seed with starter quotes
INSERT INTO encouragement_quotes (text, author) VALUES
  ('You are stronger than you think.', NULL),
  ('Every day is a new beginning. Take a deep breath and start again.', NULL),
  ('You are not alone. This circle is here for you.', NULL),
  ('Small steps still move you forward.', NULL),
  ('Your story matters. Your voice matters.', NULL),
  ('Be gentle with yourself — you are doing the best you can.', NULL),
  ('Courage doesn''t always roar. Sometimes it''s the quiet voice that says "I''ll try again tomorrow."', 'Mary Anne Radmacher'),
  ('You deserve kindness, especially from yourself.', NULL);

-- Extend notifications to support badge_awarded type and richer metadata
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS actor_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS preview    TEXT;

-- Allow the new notification type
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('comment','reply','reaction','chat','moderation','badge_awarded'));

-- Index for badge lookups
CREATE INDEX idx_badges_user_id ON badges(user_id);

-- ─── Badge award rules (enforced in application layer) ───────────────────────
-- supporter : awarded when a user's reactions received total >= 10
-- mentor    : awarded when a user has >= 5 published posts
-- listener  : awarded when a user has >= 20 published comments
