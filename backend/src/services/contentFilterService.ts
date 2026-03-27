import { Pool } from 'pg';
import { FilterResult, FilterDecision } from '../types';

// AI_THRESHOLD: content scoring above this is held for review
const AI_HOLD_THRESHOLD  = 0.7;
const AI_BLOCK_THRESHOLD = 0.92;

export class ContentFilterService {
  // In-memory cache of prohibited terms, refreshed every 5 minutes
  private termsCache: string[] = [];
  private termsCachedAt = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  constructor(
    private db: Pool,
    /** Optional: base URL of an external ML moderation API */
    private mlApiUrl?: string,
  ) {}

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Scan content before publication.
   * Runs term-matching first (fast), then AI scoring if configured.
   * Logs every decision to content_filter_log.
   */
  async scan(params: {
    content_type: 'post' | 'comment' | 'message';
    content_id: string;
    user_id: string;
    text: string;
  }): Promise<FilterResult> {
    const { content_type, content_id, user_id, text } = params;

    // 1. Term matching
    const termResult = await this.checkTerms(text);

    // 2. AI scoring (optional secondary layer)
    let aiScore: number | undefined;
    if (this.mlApiUrl) {
      aiScore = await this.callMlApi(text);
    }

    // 3. Combine decisions
    const result = this.combineDecisions(termResult, aiScore);

    // 4. Log the decision (fire-and-forget, don't block publish path)
    this.logDecision({ content_type, content_id, user_id, text, result, aiScore }).catch(() => {});

    return result;
  }

  // ─── Term matching ───────────────────────────────────────────────────────────

  private async checkTerms(text: string): Promise<{ decision: FilterDecision; matched_term?: string }> {
    const terms = await this.getTerms();
    const lower = text.toLowerCase();
    for (const term of terms) {
      if (lower.includes(term.toLowerCase())) {
        return { decision: 'hold', matched_term: term };
      }
    }
    return { decision: 'allow' };
  }

  private async getTerms(): Promise<string[]> {
    const now = Date.now();
    if (this.termsCache.length && now - this.termsCachedAt < this.CACHE_TTL_MS) {
      return this.termsCache;
    }
    const { rows } = await this.db.query<{ term: string }>(
      `SELECT term FROM prohibited_terms ORDER BY term`,
    );
    this.termsCache = rows.map((r: { term: string }) => r.term);
    this.termsCachedAt = now;
    return this.termsCache;
  }

  /** Force-refresh the terms cache (called after admin adds/removes a term). */
  invalidateTermsCache(): void {
    this.termsCachedAt = 0;
  }

  // ─── AI scoring ──────────────────────────────────────────────────────────────

  private async callMlApi(text: string): Promise<number> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(this.mlApiUrl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) return 0;
      const data = await res.json() as { score: number };
      return Math.min(1, Math.max(0, data.score ?? 0));
    } catch {
      // AI unavailable — fall back to terms-only
      return 0;
    }
  }

  // ─── Decision combiner ───────────────────────────────────────────────────────

  private combineDecisions(
    termResult: { decision: FilterDecision; matched_term?: string },
    aiScore?: number,
  ): FilterResult {
    // Term match always wins
    if (termResult.decision !== 'allow') {
      return {
        decision: termResult.decision,
        method: aiScore !== undefined ? 'combined' : 'terms',
        matched_term: termResult.matched_term,
        ai_score: aiScore,
        reason: `Prohibited term detected: "${termResult.matched_term}"`,
      };
    }

    // AI-only decision
    if (aiScore !== undefined && aiScore > 0) {
      if (aiScore >= AI_BLOCK_THRESHOLD) {
        return { decision: 'block', method: 'ai', ai_score: aiScore, reason: 'AI: high-confidence harmful content' };
      }
      if (aiScore >= AI_HOLD_THRESHOLD) {
        return { decision: 'hold', method: 'ai', ai_score: aiScore, reason: 'AI: potentially harmful content' };
      }
    }

    return {
      decision: 'allow',
      method: aiScore !== undefined ? 'combined' : 'terms',
      ai_score: aiScore,
    };
  }

  // ─── Logging ─────────────────────────────────────────────────────────────────

  private async logDecision(params: {
    content_type: 'post' | 'comment' | 'message';
    content_id: string;
    user_id: string;
    text: string;
    result: FilterResult;
    aiScore?: number;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO content_filter_log
         (content_type, content_id, user_id, raw_text, decision, method, ai_score, matched_term)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        params.content_type,
        params.content_id,
        params.user_id,
        params.text,
        params.result.decision,
        params.result.method,
        params.aiScore ?? null,
        params.result.matched_term ?? null,
      ],
    );
  }

  // ─── Admin: manage prohibited terms ─────────────────────────────────────────

  async addTerm(term: string, adminId: string): Promise<void> {
    await this.db.query(
      `INSERT INTO prohibited_terms (term, added_by) VALUES ($1, $2) ON CONFLICT (term) DO NOTHING`,
      [term.toLowerCase().trim(), adminId],
    );
    this.invalidateTermsCache();
  }

  async removeTerm(term: string): Promise<void> {
    await this.db.query(`DELETE FROM prohibited_terms WHERE term = $1`, [term]);
    this.invalidateTermsCache();
  }

  async listTerms(): Promise<string[]> {
    const { rows } = await this.db.query<{ term: string }>(`SELECT term FROM prohibited_terms ORDER BY term`);
    return rows.map((r: { term: string }) => r.term);
  }
}
