import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { EngagementService } from '../services/engagementService';

export function engagementRouter(db: Pool): Router {
  const router = Router();
  const svc = new EngagementService(db);

  // GET /engagement/quote — today's encouragement quote (public)
  router.get('/quote', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const quote = await svc.getDailyQuote();
      return res.json({ quote });
    } catch (err) {
      next(err);
    }
  });

  // GET /engagement/trending — trending discussions
  router.get('/trending', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 10, 50);
      const hours = Number(req.query.hours) || 24;
      const posts = await svc.getTrending(limit, hours);
      return res.json({ posts });
    } catch (err) {
      next(err);
    }
  });

  // GET /engagement/suggested — suggested categories for the logged-in user
  router.get('/suggested', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user.user_id;
      const categories = await svc.getSuggestedCategories(userId);
      return res.json({ categories });
    } catch (err) {
      next(err);
    }
  });

  // GET /notifications — paginated notification inbox
  router.get('/notifications', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user.user_id;
      const cursor = req.query.cursor as string | undefined;
      const result = await svc.getNotifications(userId, cursor);
      return res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // POST /notifications/read — mark notifications as read
  router.post('/notifications/read', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user.user_id;
      const { ids } = req.body as { ids: string[] };
      if (!Array.isArray(ids) || !ids.length) {
        return res.status(400).json({ error: { code: 'VALIDATION', message: 'ids array required' } });
      }
      await svc.markRead(userId, ids);
      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  // GET /users/:id/badges — get badges for a user
  router.get('/users/:id/badges', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const badges = await svc.getUserBadges(req.params.id);
      return res.json({ badges });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
