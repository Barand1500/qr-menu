import { Router, type Request, type Response } from 'express';
import { authRequired, getRestaurantId } from '../lib/auth.js';
import { allowCustomerEmailRequest as allow } from '../lib/customer-email.js';
import { adminState, applyNow, createPairCode, linkFromToken, pairWithCode, previewOps, receivePush, saveSettings, unlink } from '../lib/sefim-link.js';

/** Çırak (restoran bilgisayarındaki köprü) bu uçları kullanır: /api/sefim/... */
export const sefimBridgeRouter = Router();
sefimBridgeRouter.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

sefimBridgeRouter.post('/pair', async (req, res) => {
  if (!allow(`sefim-pair:${req.ip || 'unknown'}`, 20)) return res.status(429).json({ message: 'Çok fazla deneme. 15 dakika sonra tekrar deneyin.' });
  const done = await pairWithCode(req.body?.code, req.body?.device);
  if (!done) return res.status(400).json({ message: 'Kod hatalı ya da süresi dolmuş. Panelden yeni kod alın.' });
  res.json({ token: done.token, restaurant: done.restaurantName });
});

sefimBridgeRouter.post('/push', async (req, res) => {
  if (!allow(`sefim-push:${req.ip || 'unknown'}`, 600)) return res.status(429).json({ message: 'Çok sık gönderim.' });
  const link = await linkFromToken(req.headers.authorization);
  if (!link) return res.status(401).json({ message: 'Bağlantı anahtarı geçersiz. Çırak\'ı panelden yeniden eşleştirin.', code: 'UNLINKED' });
  try {
    res.json(await receivePush(link, req.body));
  } catch (e) {
    console.error('[sefim] push', e);
    res.status(500).json({ message: 'Sunucu görüntüyü işleyemedi.' });
  }
});

/** Panel: /api/admin/sefim/... */
export const sefimAdminRouter = Router();
sefimAdminRouter.use(authRequired);

const rid = async (req: Request, res: Response) => {
  const id = await getRestaurantId(req);
  if (!id) res.status(403).json({ message: 'Restoran bulunamadı' });
  return id;
};

sefimAdminRouter.get('/', async (req, res) => {
  const id = await rid(req, res);
  if (id) res.json(await adminState(id));
});

sefimAdminRouter.put('/settings', async (req, res) => {
  const id = await rid(req, res);
  if (!id) return;
  await saveSettings(id, req.body);
  res.json(await adminState(id));
});

sefimAdminRouter.post('/pair-code', async (req, res) => {
  const id = await rid(req, res);
  if (id) res.json(await createPairCode(id));
});

sefimAdminRouter.get('/preview', async (req, res) => {
  const id = await rid(req, res);
  if (id) res.json(await previewOps(id));
});

sefimAdminRouter.post('/apply', async (req, res) => {
  const id = await rid(req, res);
  if (!id) return;
  try {
    const r = await applyNow(id, false);
    if (!r) return res.status(400).json({ message: 'Henüz Şefim\'den veri gelmedi. Çırak bağlanınca tekrar deneyin.' });
    res.json({ ...r, state: await adminState(id) });
  } catch {
    res.status(500).json({ message: 'Menü güncellenemedi. Hiçbir değişiklik yarım kalmadı; tekrar deneyin.' });
  }
});

sefimAdminRouter.delete('/', async (req, res) => {
  const id = await rid(req, res);
  if (!id) return;
  await unlink(id);
  res.json(await adminState(id));
});
