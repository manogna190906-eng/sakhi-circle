import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { SafetyService } from '../services/safetyService';
import { ContentFilterService } from '../services/contentFilterService';

export function safetyRouter(db: Pool, filter: ContentFilterService): Router {
  const router = Router();
  const svc = new SafetyService(db);

  // ─── Reports ─────────────────────────────────────────────────────────────────

  // POST /safety/reports
  router.post('/reports', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reporter_id = (req as any).user.user_id;
      const { reason, reported_user_id, post_id, comment_id, message_id } = req.body;
      if (!reason) return res.status(400).json({ error: { code: 'VALIDATION', message: 'reason required' } });

      const report = await svc.createReport({ reporter_id, reason, reported_user_id, post_id, comment_id, message_id });
      return res.status(201).json({ report });
    } catch (err) { next(err); }
  });

  // ─── Block / unblock ─────────────────────────────────────────────────────────

  // POST /safety/block/:userId
  router.post('/block/:userId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const blockerId = (req as any).user.user_id;
      await svc.blockUser(blockerId, req.params.userId);
      return res.status(204).send();
    } catch (err: any) {
      if (err.message === 'Cannot block yourself') return res.status(400).json({ error: { code: 'INVALID', message: err.message } });
      next(err);
    }
  });

  // DELETE /safety/block/:userId
  router.delete('/block/:userId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const blockerId = (req as any).user.user_id;
      await svc.unblockUser(blockerId, req.params.userId);
      return res.status(204).send();
    } catch (err) { next(err); }
  });

  // GET /safety/blocked
  router.get('/blocked', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user.user_id;
      const users = await svc.getBlockedUsers(userId);
      return res.json({ users });
    } catch (err) { next(err); }
  });

  // ─── Help resources ──────────────────────────────────────────────────────────

  // GET /safety/help-resources
  router.get('/help-resources', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = req.query.category as string | undefined;
      const resources = await svc.getHelpResources(category);
      return res.json({ resources });
    } catch (err) { next(err); }
  });

  // ─── Admin endpoints (require admin role) ────────────────────────────────────

  function requireAdmin(req: Request, res: Response, next: NextFunction) {
    if ((req as any).user?.role !== 'admin') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin only' } });
    }
    next();
  }

  // GET /safety/admin/queue
  router.get('/admin/queue', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = (req.query.status as any) ?? 'pending';
      const items = await svc.getModerationQueue(status);
      return res.json({ items });
    } catch (err) { next(err); }
  });

  // PUT /safety/admin/action
  router.put('/admin/action', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminId = (req as any).user.user_id;
      const { target_type, target_id, action, reason } = req.body;
      if (!target_type || !target_id || !action || !reason) {
        return res.status(400).json({ error: { code: 'VALIDATION', message: 'target_type, target_id, action, reason required' } });
      }
      await svc.takeAction({ target_type, target_id, action, reason }, adminId);
      return res.status(204).send();
    } catch (err) { next(err); }
  });

  // GET /safety/admin/metrics
  router.get('/admin/metrics', requireAdmin, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const metrics = await svc.getMetrics();
      return res.json({ metrics });
    } catch (err) { next(err); }
  });

  // GET /safety/admin/filter-terms
  router.get('/admin/filter-terms', requireAdmin, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const terms = await filter.listTerms();
      return res.json({ terms });
    } catch (err) { next(err); }
  });

  // POST /safety/admin/filter-terms
  router.post('/admin/filter-terms', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminId = (req as any).user.user_id;
      const { term } = req.body;
      if (!term?.trim()) return res.status(400).json({ error: { code: 'VALIDATION', message: 'term required' } });
      await filter.addTerm(term, adminId);
      return res.status(204).send();
    } catch (err) { next(err); }
  });

  // DELETE /safety/admin/filter-terms/:term
  router.delete('/admin/filter-terms/:term', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      await filter.removeTerm(decodeURIComponent(req.params.term));
      return res.status(204).send();
    } catch (err) { next(err); }
  });

  return router;
}
