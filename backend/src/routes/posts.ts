import { Router, Request, Response, NextFunction } from 'express';
import { PostService } from '../services/postService';
import { Pool } from 'pg';

export function postsRouter(db: Pool): Router {
  const router = Router();
  const svc = new PostService(db);

  // POST /posts — create a post
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { title, content, type, category, is_anonymous } = req.body;
      const user_id = (req as any).user.user_id;

      if (!title || !content || !type || !category) {
        return res.status(400).json({ error: { code: 'VALIDATION', message: 'title, content, type, and category are required' } });
      }

      const post = await svc.createPost({
        user_id,
        title,
        content,
        type,
        category,
        is_anonymous: Boolean(is_anonymous),
      });

      return res.status(201).json({ post });
    } catch (err) {
      next(err);
    }
  });

  // GET /posts/:id — fetch post with comments
  // Admins receive real identities; regular users see "Anonymous Sister" for anonymous content
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isAdmin = (req as any).user?.role === 'admin';
      const result = await svc.getPost(req.params.id, isAdmin);
      return res.json(result);
    } catch (err: any) {
      if (err.message === 'Post not found') return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Post not found' } });
      next(err);
    }
  });

  // POST /posts/:id/comments — add a comment or reply
  router.post('/:id/comments', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { content, is_anonymous, parent_comment_id } = req.body;
      const user_id = (req as any).user.user_id;

      if (!content?.trim()) {
        return res.status(400).json({ error: { code: 'VALIDATION', message: 'content is required' } });
      }

      const comment = await svc.createComment({
        post_id: req.params.id,
        user_id,
        content,
        is_anonymous: Boolean(is_anonymous),
        parent_comment_id,
      });

      return res.status(201).json({ comment });
    } catch (err) {
      next(err);
    }
  });

  // DELETE /posts/:id — soft-delete
  router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user_id = (req as any).user.user_id;
      const isAdmin = (req as any).user?.role === 'admin';
      await svc.deletePost(req.params.id, user_id, isAdmin);
      return res.status(204).send();
    } catch (err: any) {
      if (err.message === 'Post not found') return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Post not found' } });
      if (err.message === 'Forbidden') return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not allowed' } });
      next(err);
    }
  });

  return router;
}
