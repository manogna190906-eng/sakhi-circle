import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Pool } from 'pg';
import { postsRouter } from './routes/posts';
import { engagementRouter } from './routes/engagement';
import { safetyRouter } from './routes/safety';
import { ContentFilterService } from './services/contentFilterService';

const app  = express();
const port = process.env.PORT ?? 3000;

// ─── Database ────────────────────────────────────────────────────────────────
const db = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// ─── Services ────────────────────────────────────────────────────────────────
const contentFilter = new ContentFilterService(db, process.env.ML_API_URL);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGIN ?? '*' }));
app.use(express.json());

// Simple JWT auth middleware (attach user to req)
app.use((req, res, next) => {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    try {
      const jwt = require('jsonwebtoken');
      (req as any).user = jwt.verify(auth.slice(7), process.env.JWT_SECRET ?? 'dev-secret');
    } catch {}
  }
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/posts',      postsRouter(db));
app.use('/engagement', engagementRouter(db));
app.use('/safety',     safetyRouter(db, contentFilter));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
});

app.listen(port, () => console.log(`Sakhi Circle API running on port ${port}`));
