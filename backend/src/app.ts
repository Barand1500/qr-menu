import cors from 'cors';
import express from 'express';
import fs from 'fs';
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
import translateRouter from './routes/translate.js';
import complaintsRouter from './routes/complaints.js';
import suggestionsRouter from './routes/suggestions.js';
import tableRequestsRouter from './routes/table-requests.js';
import currenciesRouter from './routes/currencies.js';
import addonsRouter from './routes/addons.js';
import barcodeRouter from './routes/barcode.js';
import campaignsRouter from './routes/campaigns.js';
import bulkTranslateRouter from './routes/bulk-translate.js';
import tableFloorRouter from './routes/table-floor.js';
import mapTilesRouter from './routes/map-tiles.js';

export function createApp() {
  const app = express();

  app.use((_req, res, next) => {
    // OSM / harita karoları için Referer gönderilebilsin (no-referrer engelini gevşet)
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

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
  app.use('/api/admin/translate', translateRouter);
  app.use('/api/admin/complaints', complaintsRouter);
  app.use('/api/admin/suggestions', suggestionsRouter);
  app.use('/api/admin/table-requests', tableRequestsRouter);
  app.use('/api/admin/currencies', currenciesRouter);
  app.use('/api/admin/addons', addonsRouter);
  app.use('/api/admin/barcode', barcodeRouter);
  app.use('/api/admin/campaigns', campaignsRouter);
  app.use('/api/admin/bulk-translate', bulkTranslateRouter);
  app.use('/api/admin/table-floor', tableFloorRouter);
  app.use('/api/menu', publicMenuRouter);
  app.use('/api/map-tiles', mapTilesRouter);

  const publicDir = path.resolve(process.env.PUBLIC_DIR || './public');
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir, { index: false }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
        return next();
      }
      res.sendFile(path.join(publicDir, 'index.html'), (err) => {
        if (err) next();
      });
    });
  }

  app.use((_req, res) => {
    res.status(404).json({ message: 'Endpoint bulunamadı' });
  });

  app.use((err: Error & { status?: number; statusCode?: number; type?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ message: 'Geçersiz istek gövdesi' });
    }
    res.status(err.status || err.statusCode || 500).json({ message: 'Sunucu hatası' });
  });

  return app;
}
