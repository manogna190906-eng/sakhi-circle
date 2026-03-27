// Core domain types for Sakhi Circle

export interface User {
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  is_anonymous: boolean;       // profile-level default toggle
  profile_visibility: 'public' | 'private';
  bio: string | null;
  interests: string[];
  role: 'user' | 'admin';
  status: 'active' | 'warned' | 'suspended' | 'banned';
  created_at: string;
}

export interface Post {
  post_id: string;
  user_id: string;             // always stored internally
  content: string;
  title: string;
  type: 'question' | 'experience' | 'help_request';
  category: string;
  is_anonymous: boolean;       // per-post toggle
  status: 'published' | 'pending_review' | 'removed';
  created_at: string;
}

export interface Comment {
  comment_id: string;
  post_id: string;
  user_id: string;             // always stored internally
  parent_comment_id: string | null;  // null = top-level, set = reply
  content: string;
  is_anonymous: boolean;       // per-comment toggle
  status: 'published' | 'pending_review' | 'removed';
  created_at: string;
}

export interface Reaction {
  reaction_id: string;
  post_id: string;
  user_id: string;
  type: 'support' | 'hug' | 'strong' | 'like';
}

export interface Message {
  message_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  deleted_by_sender: boolean;
  timestamp: string;
}

export interface Report {
  report_id: string;
  reporter_id: string;
  reported_user_id: string | null;
  post_id: string | null;
  comment_id: string | null;
  message_id: string | null;
  reason: string;
  status: 'pending' | 'reviewed' | 'escalated' | 'resolved';
  created_at: string;
}

export interface Notification {
  notification_id: string;
  user_id: string;
  type: 'comment' | 'reply' | 'reaction' | 'chat' | 'moderation';
  reference_id: string;
  is_read: boolean;
  created_at: string;
}

// ─── Public-safe projection types ────────────────────────────────────────────
// These are what the API returns to non-admin clients.
// Real identity is stripped when is_anonymous = true.

export const ANONYMOUS_DISPLAY_NAME = 'Anonymous Sister';
export const ANONYMOUS_AVATAR = null;

export interface PublicAuthor {
  user_id: string | null;      // null for anonymous
  name: string;                // 'Anonymous Sister' or real name
  avatar: string | null;
}

export interface PublicPost extends Omit<Post, 'user_id'> {
  author: PublicAuthor;
  reaction_counts: Record<Reaction['type'], number>;
  comment_count: number;
}

export interface PublicComment extends Omit<Comment, 'user_id'> {
  author: PublicAuthor;
  replies?: PublicComment[];
}

// ─── Engagement feature types ─────────────────────────────────────────────────

export type BadgeType = 'supporter' | 'mentor' | 'listener';

export interface Badge {
  badge_id: string;
  user_id: string;
  type: BadgeType;
  awarded_at: string;
}

export interface EncouragementQuote {
  quote_id: string;
  text: string;
  author: string | null;
  active: boolean;
}

export interface TrendingPost {
  post_id: string;
  title: string;
  category: string;
  reaction_total: number;
  comment_count: number;
  created_at: string;
}

export interface SuggestedCategory {
  category: string;
  match_score: number;   // 0–1, based on overlap with user interests
  post_count: number;
}

// Extended notification type that includes the new engagement events
export type NotificationType =
  | 'comment'
  | 'reply'
  | 'reaction'
  | 'chat'
  | 'moderation'
  | 'badge_awarded';

export interface EngagementNotification extends Omit<Notification, 'type'> {
  type: NotificationType;
  actor_name: string | null;   // who triggered it (null for system events)
  preview: string | null;      // short content preview
}

// ─── Safety feature types ─────────────────────────────────────────────────────

export type FilterDecision = 'allow' | 'hold' | 'block';
export type FilterMethod   = 'terms' | 'ai' | 'combined';

export interface FilterResult {
  decision: FilterDecision;
  method: FilterMethod;
  ai_score?: number;       // 0–1 from ML model
  matched_term?: string;   // which prohibited term triggered
  reason?: string;         // human-readable summary
}

export interface ContentFilterLog {
  log_id: string;
  content_type: 'post' | 'comment' | 'message';
  content_id: string;
  user_id: string;
  decision: FilterDecision;
  method: FilterMethod;
  ai_score: number | null;
  matched_term: string | null;
  created_at: string;
}

export interface HelpResource {
  resource_id: string;
  title: string;
  description: string | null;
  phone: string | null;
  url: string | null;
  category: 'crisis' | 'mental_health' | 'safety' | 'legal' | 'medical';
  country_code: string;
  active: boolean;
  sort_order: number;
}

export interface ModerationQueueItem {
  report_id: string;
  priority: 'normal' | 'high';
  status: Report['status'];
  reason: string;
  created_at: string;
  reporter_id: string;
  // target details
  target_type: 'post' | 'comment' | 'user';
  target_id: string;
  target_preview: string | null;
  // real author (always visible to admin)
  author_id: string | null;
  author_name: string | null;
  ai_risk_score: number | null;
}

export interface AdminAction {
  target_type: 'post' | 'comment' | 'user';
  target_id: string;
  action: 'approve' | 'remove' | 'warn' | 'suspend' | 'ban';
  reason: string;
}
