-- Sakhi Circle — initial schema migration

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users
CREATE TABLE users (
  user_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(100) NOT NULL,
  email            VARCHAR(255) UNIQUE,
  phone            VARCHAR(20)  UNIQUE,
  password_hash    TEXT,
  is_anonymous     BOOLEAN NOT NULL DEFAULT FALSE,
  profile_visibility VARCHAR(10) NOT NULL DEFAULT 'public' CHECK (profile_visibility IN ('public','private')),
  bio              TEXT,
  interests        TEXT[] NOT NULL DEFAULT '{}',
  role             VARCHAR(10) NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  status           VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active','warned','suspended','banned')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_email_or_phone CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

-- Posts
-- user_id is ALWAYS stored; is_anonymous controls public display only
CREATE TABLE posts (
  post_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  title      VARCHAR(300) NOT NULL,
  content    TEXT NOT NULL,
  type       VARCHAR(20) NOT NULL CHECK (type IN ('question','experience','help_request')),
  category   VARCHAR(50) NOT NULL,
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  status     VARCHAR(20) NOT NULL DEFAULT 'published'
               CHECK (status IN ('published','pending_review','removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comments (supports threaded replies via parent_comment_id)
-- user_id is ALWAYS stored; is_anonymous controls public display only
CREATE TABLE comments (
  comment_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id           UUID NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES comments(comment_id) ON DELETE CASCADE,
  content           TEXT NOT NULL,
  is_anonymous      BOOLEAN NOT NULL DEFAULT FALSE,
  status            VARCHAR(20) NOT NULL DEFAULT 'published'
                      CHECK (status IN ('published','pending_review','removed')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reactions — one per user per post enforced by unique constraint
CREATE TABLE reactions (
  reaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  type        VARCHAR(10) NOT NULL CHECK (type IN ('support','hug','strong','like')),
  UNIQUE (post_id, user_id)
);

-- Messages
CREATE TABLE messages (
  message_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  receiver_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  content           TEXT NOT NULL,
  deleted_by_sender BOOLEAN NOT NULL DEFAULT FALSE,
  timestamp         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reports
CREATE TABLE reports (
  report_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id      UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  post_id          UUID REFERENCES posts(post_id) ON DELETE SET NULL,
  comment_id       UUID REFERENCES comments(comment_id) ON DELETE SET NULL,
  message_id       UUID REFERENCES messages(message_id) ON DELETE SET NULL,
  reason           TEXT NOT NULL,
  status           VARCHAR(10) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','reviewed','escalated','resolved')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Blocked users
CREATE TABLE blocked_users (
  blocker_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id)
);

-- Notifications
CREATE TABLE notifications (
  notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  type            VARCHAR(20) NOT NULL CHECK (type IN ('comment','reply','reaction','chat','moderation')),
  reference_id    UUID NOT NULL,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log for admin actions
CREATE TABLE audit_logs (
  log_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id   UUID NOT NULL REFERENCES users(user_id),
  action     TEXT NOT NULL,
  target_id  UUID,
  reason     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX idx_posts_user_id    ON posts(user_id);
CREATE INDEX idx_posts_category   ON posts(category);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_reactions_post_id ON reactions(post_id);
CREATE INDEX idx_messages_sender  ON messages(sender_id);
CREATE INDEX idx_messages_receiver ON messages(receiver_id);
CREATE INDEX idx_reports_status   ON reports(status);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
