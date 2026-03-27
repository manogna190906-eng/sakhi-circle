import { Pool } from 'pg';
import {
  Badge,
  BadgeType,
  EncouragementQuote,
  TrendingPost,
  SuggestedCategory,
  EngagementNotification,
} from '../types';

// Badge thresholds
const BADGE_THRESHOLDS: Record<BadgeType, { metric: string; threshold: number }> = {
  supporter: { metric: 'reactions_received', threshold: 10 },
  mentor:    { metric: 'post_count',         threshold: 5  },
  listener:  { metric: 'comment_count',      threshold: 20 },
};

export class EngagementService {
  constructor(private db: Pool) {}

  // ─── Daily quote ────────────────────────────────────────────────────────────

  /** Returns a deterministic daily quote (rotates by day-of-year). */
  async getDailyQuote(): Promise<EncouragementQuote> {
    const { rows } = await this.db.query<EncouragementQuote>(
      `SELECT * FROM encouragement_quotes WHERE active = TRUE ORDER BY quote_id`,
    );
    if (!rows.length) throw new Error('No quotes available');
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000,
    );
    return rows[dayOfYear % rows.length];
  }

  // ─── Trending discussions ────────────────────────────────────────────────────

  /**
   * Returns top posts by combined reaction + comment activity
   * in the last `hours` hours (default 24).
   */
  async getTrending(limit = 10, hours = 24): Promise<TrendingPost[]> {
    const { rows } = await this.db.query<TrendingPost>(
      `SELECT
         p.post_id,
         p.title,
         p.category,
         p.created_at,
         COUNT(DISTINCT r.reaction_id)::int AS reaction_total,
         COUNT(DISTINCT c.comment_id)::int  AS comment_count
       FROM posts p
       LEFT JOIN reactions r ON r.post_id = p.post_id
       LEFT JOIN comments  c ON c.post_id = p.post_id AND c.status = 'published'
       WHERE p.status = 'published'
         AND p.created_at >= NOW() - ($2 || ' hours')::INTERVAL
       GROUP BY p.post_id
       ORDER BY (COUNT(DISTINCT r.reaction_id) + COUNT(DISTINCT c.comment_id)) DESC
       LIMIT $1`,
      [limit, hours],
    );
    return rows;
  }

  // ─── Suggested categories ────────────────────────────────────────────────────

  /**
   * Suggests categories based on overlap between user interests and category names.
   * Falls back to most-active categories when there's no interest match.
   */
  async getSuggestedCategories(userId: string, limit = 4): Promise<SuggestedCategory[]> {
    // Fetch user interests
    const { rows: userRows } = await this.db.query<{ interests: string[] }>(
      `SELECT interests FROM users WHERE user_id = $1`,
      [userId],
    );
    const interests: string[] = userRows[0]?.interests ?? [];

    // Get all categories with post counts
    const { rows: catRows } = await this.db.query<{ category: string; post_count: number }>(
      `SELECT category, COUNT(*)::int AS post_count
       FROM posts WHERE status = 'published'
       GROUP BY category`,
    );

    // Score each category by interest overlap (simple substring match)
    const scored: SuggestedCategory[] = catRows.map((row) => {
      const catLower = row.category.toLowerCase();
      const matchScore = interests.some((i) => catLower.includes(i.toLowerCase()) || i.toLowerCase().includes(catLower))
        ? 1
        : 0;
      return { category: row.category, match_score: matchScore, post_count: row.post_count };
    });

    // Sort: interest matches first, then by post count
    scored.sort((a, b) => b.match_score - a.match_score || b.post_count - a.post_count);
    return scored.slice(0, limit);
  }

  // ─── Notifications ───────────────────────────────────────────────────────────

  /** Fetch paginated notifications for a user with actor name and preview. */
  async getNotifications(
    userId: string,
    cursor?: string,
    pageSize = 20,
  ): Promise<{ notifications: EngagementNotification[]; nextCursor: string | null }> {
    const { rows } = await this.db.query<EngagementNotification>(
      `SELECT
         notification_id, user_id, type, reference_id,
         is_read, created_at, actor_name, preview
       FROM notifications
       WHERE user_id = $1
         AND ($2::uuid IS NULL OR notification_id < $2::uuid)
       ORDER BY created_at DESC
       LIMIT $3`,
      [userId, cursor ?? null, pageSize + 1],
    );

    const hasMore = rows.length > pageSize;
    const page = hasMore ? rows.slice(0, pageSize) : rows;
    const nextCursor = hasMore ? page[page.length - 1].notification_id : null;
    return { notifications: page, nextCursor };
  }

  /** Create a notification (called internally after comment/reply/reaction/chat/badge events). */
  async createNotification(params: {
    user_id: string;
    type: EngagementNotification['type'];
    reference_id: string;
    actor_name?: string;
    preview?: string;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO notifications (user_id, type, reference_id, actor_name, preview)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        params.user_id,
        params.type,
        params.reference_id,
        params.actor_name ?? null,
        params.preview ?? null,
      ],
    );
  }

  /** Mark notifications as read. */
  async markRead(userId: string, ids: string[]): Promise<void> {
    await this.db.query(
      `UPDATE notifications SET is_read = TRUE
       WHERE user_id = $1 AND notification_id = ANY($2::uuid[])`,
      [userId, ids],
    );
  }

  // ─── Badge system ────────────────────────────────────────────────────────────

  /** Check and award any newly earned badges for a user. Returns newly awarded badges. */
  async checkAndAwardBadges(userId: string): Promise<Badge[]> {
    const awarded: Badge[] = [];

    // Fetch current metrics in one query
    const { rows } = await this.db.query<{
      post_count: number;
      comment_count: number;
      reactions_received: number;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM posts    WHERE user_id = $1 AND status = 'published')::int AS post_count,
         (SELECT COUNT(*) FROM comments WHERE user_id = $1 AND status = 'published')::int AS comment_count,
         (SELECT COUNT(*) FROM reactions r
            JOIN posts p ON p.post_id = r.post_id
            WHERE p.user_id = $1)::int AS reactions_received`,
      [userId],
    );
    const metrics = rows[0];

    const metricMap: Record<string, number> = {
      post_count:         metrics.post_count,
      comment_count:      metrics.comment_count,
      reactions_received: metrics.reactions_received,
    };

    for (const [badgeType, rule] of Object.entries(BADGE_THRESHOLDS) as [BadgeType, typeof BADGE_THRESHOLDS[BadgeType]][]) {
      if (metricMap[rule.metric] < rule.threshold) continue;

      // Try to insert; skip if already awarded (unique constraint)
      const { rows: inserted } = await this.db.query<Badge>(
        `INSERT INTO badges (user_id, type)
         VALUES ($1, $2)
         ON CONFLICT (user_id, type) DO NOTHING
         RETURNING *`,
        [userId, badgeType],
      );

      if (inserted.length) {
        awarded.push(inserted[0]);
        // Fire a notification for the badge
        await this.createNotification({
          user_id: userId,
          type: 'badge_awarded',
          reference_id: inserted[0].badge_id,
          preview: `You earned the ${badgeType.charAt(0).toUpperCase() + badgeType.slice(1)} badge!`,
        });
      }
    }

    return awarded;
  }

  /** Get all badges for a user. */
  async getUserBadges(userId: string): Promise<Badge[]> {
    const { rows } = await this.db.query<Badge>(
      `SELECT * FROM badges WHERE user_id = $1 ORDER BY awarded_at ASC`,
      [userId],
    );
    return rows;
  }
}
