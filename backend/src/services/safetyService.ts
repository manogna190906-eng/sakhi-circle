import { Pool } from 'pg';
import { Report, ModerationQueueItem, AdminAction, HelpResource } from '../types';

// Auto-escalate when a target receives this many reports within 24h
const ESCALATION_THRESHOLD = 5;

export class SafetyService {
  constructor(private db: Pool) {}

  // ─── Reporting ───────────────────────────────────────────────────────────────

  async createReport(params: {
    reporter_id: string;
    reason: string;
    reported_user_id?: string;
    post_id?: string;
    comment_id?: string;
    message_id?: string;
  }): Promise<Report> {
    const { rows } = await this.db.query<Report>(
      `INSERT INTO reports
         (reporter_id, reason, reported_user_id, post_id, comment_id, message_id)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [
        params.reporter_id,
        params.reason,
        params.reported_user_id ?? null,
        params.post_id ?? null,
        params.comment_id ?? null,
        params.message_id ?? null,
      ],
    );
    const report = rows[0];

    // Check auto-escalation
    await this.checkEscalation(report);
    return report;
  }

  private async checkEscalation(report: Report): Promise<void> {
    // Count reports against the same target in the last 24h
    const targetId = report.post_id ?? report.reported_user_id ?? report.comment_id;
    if (!targetId) return;

    const { rows } = await this.db.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM reports
       WHERE (post_id = $1 OR reported_user_id = $1 OR comment_id = $1)
         AND created_at >= NOW() - INTERVAL '24 hours'`,
      [targetId],
    );

    if (rows[0].count >= ESCALATION_THRESHOLD) {
      await this.db.query(
        `UPDATE reports SET priority = 'high'
         WHERE (post_id = $1 OR reported_user_id = $1 OR comment_id = $1)
           AND status = 'pending'`,
        [targetId],
      );
    }
  }

  // ─── Block / unblock ─────────────────────────────────────────────────────────

  async blockUser(blockerId: string, blockedId: string): Promise<void> {
    if (blockerId === blockedId) throw new Error('Cannot block yourself');
    await this.db.query(
      `INSERT INTO blocked_users (blocker_id, blocked_id)
       VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [blockerId, blockedId],
    );
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    await this.db.query(
      `DELETE FROM blocked_users WHERE blocker_id = $1 AND blocked_id = $2`,
      [blockerId, blockedId],
    );
  }

  async getBlockedUsers(userId: string): Promise<{ user_id: string; name: string }[]> {
    const { rows } = await this.db.query<{ user_id: string; name: string }>(
      `SELECT u.user_id, u.name
       FROM blocked_users b
       JOIN users u ON u.user_id = b.blocked_id
       WHERE b.blocker_id = $1
       ORDER BY b.created_at DESC`,
      [userId],
    );
    return rows;
  }

  async isBlocked(viewerId: string, targetId: string): Promise<boolean> {
    const { rows } = await this.db.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM blocked_users
         WHERE (blocker_id = $1 AND blocked_id = $2)
            OR (blocker_id = $2 AND blocked_id = $1)
       ) AS exists`,
      [viewerId, targetId],
    );
    return rows[0].exists;
  }

  // ─── Admin moderation queue ──────────────────────────────────────────────────

  async getModerationQueue(
    status: Report['status'] = 'pending',
    limit = 50,
  ): Promise<ModerationQueueItem[]> {
    const { rows } = await this.db.query<ModerationQueueItem>(
      `SELECT
         r.report_id, r.priority, r.status, r.reason, r.created_at,
         r.reporter_id,
         CASE
           WHEN r.post_id    IS NOT NULL THEN 'post'
           WHEN r.comment_id IS NOT NULL THEN 'comment'
           ELSE 'user'
         END AS target_type,
         COALESCE(r.post_id::text, r.comment_id::text, r.reported_user_id::text) AS target_id,
         COALESCE(
           LEFT(p.content, 120),
           LEFT(c.content, 120),
           u.name
         ) AS target_preview,
         COALESCE(p.user_id, c.user_id, r.reported_user_id) AS author_id,
         COALESCE(pu.name, cu.name, ru.name) AS author_name,
         COALESCE(p.ai_risk_score, c.ai_risk_score) AS ai_risk_score
       FROM reports r
       LEFT JOIN posts    p  ON p.post_id    = r.post_id
       LEFT JOIN users    pu ON pu.user_id   = p.user_id
       LEFT JOIN comments c  ON c.comment_id = r.comment_id
       LEFT JOIN users    cu ON cu.user_id   = c.user_id
       LEFT JOIN users    ru ON ru.user_id   = r.reported_user_id
       WHERE r.status = $1
       ORDER BY
         CASE r.priority WHEN 'high' THEN 0 ELSE 1 END,
         r.created_at ASC
       LIMIT $2`,
      [status, limit],
    );
    return rows;
  }

  async takeAction(action: AdminAction, adminId: string): Promise<void> {
    const { target_type, target_id, action: act, reason } = action;

    if (target_type === 'post') {
      if (act === 'remove') {
        await this.db.query(`UPDATE posts SET status = 'removed' WHERE post_id = $1`, [target_id]);
      } else if (act === 'approve') {
        await this.db.query(`UPDATE posts SET status = 'published' WHERE post_id = $1`, [target_id]);
      }
    } else if (target_type === 'comment') {
      if (act === 'remove') {
        await this.db.query(`UPDATE comments SET status = 'removed' WHERE comment_id = $1`, [target_id]);
      } else if (act === 'approve') {
        await this.db.query(`UPDATE comments SET status = 'published' WHERE comment_id = $1`, [target_id]);
      }
    } else if (target_type === 'user') {
      const statusMap: Record<string, string> = {
        warn: 'warned', suspend: 'suspended', ban: 'banned',
      };
      const newStatus = statusMap[act];
      if (newStatus) {
        await this.db.query(`UPDATE users SET status = $1 WHERE user_id = $2`, [newStatus, target_id]);
      }
    }

    // Resolve related reports
    await this.db.query(
      `UPDATE reports SET status = 'resolved'
       WHERE (post_id = $1 OR comment_id = $1 OR reported_user_id = $1)
         AND status IN ('pending','escalated')`,
      [target_id],
    );

    // Write audit log
    await this.db.query(
      `INSERT INTO audit_logs (admin_id, action, target_id, reason)
       VALUES ($1,$2,$3,$4)`,
      [adminId, `${act}_${target_type}`, target_id, reason],
    );
  }

  async getMetrics(): Promise<{
    total_reports: number;
    pending_reports: number;
    escalated_reports: number;
    active_suspensions: number;
    active_bans: number;
  }> {
    const { rows } = await this.db.query(
      `SELECT
         COUNT(*)::int                                              AS total_reports,
         COUNT(*) FILTER (WHERE status = 'pending')::int           AS pending_reports,
         COUNT(*) FILTER (WHERE status = 'escalated')::int         AS escalated_reports,
         (SELECT COUNT(*)::int FROM users WHERE status = 'suspended') AS active_suspensions,
         (SELECT COUNT(*)::int FROM users WHERE status = 'banned')    AS active_bans
       FROM reports`,
    );
    return rows[0];
  }

  // ─── Help resources ──────────────────────────────────────────────────────────

  async getHelpResources(category?: string): Promise<HelpResource[]> {
    const { rows } = await this.db.query<HelpResource>(
      `SELECT * FROM help_resources
       WHERE active = TRUE
         AND ($1::text IS NULL OR category = $1)
       ORDER BY sort_order ASC`,
      [category ?? null],
    );
    return rows;
  }
}
