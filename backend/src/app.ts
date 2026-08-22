import cors from 'cors';
import express from 'express';
import path from 'path';
import { config } from './config.js';
import authRouter from './routes/auth.js';
import groupsRouter from './routes/groups.js';
import productsRouter from './routes/products.js';
import dashboardRouter from './routes/dashboard.js';
import statsRouter from './routes/stats.js';
import showcaseRouter from './routes/showcase.js';
import usersRouter from './routes/users.js';
import settingsRouter from './routes/settings.js';
import publicMenuRouter from './routes/public-menu.js';
import languagesRouter from './routes/languages.js';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: config.corsOrigin.includes('*') ? true : config.corsOrigin,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use('/uploads', express.static(path.resolve(config.uploadDir)));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: config.version });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/admin/groups', groupsRouter);
  app.use('/api/admin/products', productsRouter);
  app.use('/api/admin/dashboard', dashboardRouter);
  app.use('/api/admin/stats', statsRouter);
  app.use('/api/admin/showcase', showcaseRouter);
  app.use('/api/admin/users', usersRouter);
  app.use('/api/admin/settings', settingsRouter);
  app.use('/api/admin/languages', languagesRouter);
  app.use('/api/menu', publicMenuRouter);

  app.use((_req, res) => {
    res.status(404).json({ message: 'Endpoint bulunamadı' });
  });

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ message: 'Sunucu hatası' });
  });

  return app;
}
