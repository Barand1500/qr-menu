import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import {
  isMenuGamesEnabled,
  MENU_GAMES_CONFIG_KEY,
  MENU_GAMES_KEY,
  parseMenuGamesConfig,
} from '../lib/menu-games.js';
import {
  getXoxRoom,
  joinXoxRoom,
  leaveXoxRoom,
  playXoxMove,
  rematchXox,
} from '../lib/xox-rooms.js';

const router = Router({ mergeParams: true });

async function loadRestaurant(slug: string) {
  return prisma.restaurant.findUnique({ where: { slug } });
}

async function loadGamesConfig(restaurantId: number) {
  const [cfg, legacy] = await Promise.all([
    prisma.setting.findFirst({ where: { restaurantId, key: MENU_GAMES_CONFIG_KEY } }),
    prisma.setting.findFirst({ where: { restaurantId, key: MENU_GAMES_KEY } }),
  ]);
  return parseMenuGamesConfig(cfg?.value, legacy?.value);
}

function guestIdFrom(req: { body?: { guestId?: unknown }; query?: { guestId?: unknown } }) {
  const raw = req.body?.guestId ?? req.query?.guestId;
  const id = typeof raw === 'string' ? raw.trim() : '';
  if (!id || id.length < 8 || id.length > 64) return null;
  return id;
}

router.post('/:slug/games/xox/join', async (req, res) => {
  const restaurant = await loadRestaurant(req.params.slug);
  if (!restaurant) return res.status(404).json({ message: 'Menü bulunamadı' });
  const games = await loadGamesConfig(restaurant.id);
  if (!isMenuGamesEnabled(games) || !games.xox.enabled) {
    return res.status(403).json({ message: 'Oyunlar kapalı', code: 'GAMES_OFF' });
  }

  const guestId = guestIdFrom(req);
  if (!guestId) return res.status(400).json({ message: 'guestId gerekli' });

  const tableNumber = String(req.body?.tableNumber || '').trim();
  if (!tableNumber) {
    return res.status(400).json({
      message: 'Masa bilgisi yok. QR ile masaya giriş yapın.',
      code: 'NO_TABLE',
    });
  }
  const groupSlug =
    typeof req.body?.groupSlug === 'string' && req.body.groupSlug.trim()
      ? req.body.groupSlug.trim()
      : null;

  try {
    const room = joinXoxRoom({
      restaurantId: restaurant.id,
      tableNumber,
      groupSlug,
      guestId,
    });
    res.json({ ok: true, room });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'ROOM_FULL') {
      return res.status(409).json({
        message: 'Bu masada oyun dolu. Bitmesini bekleyin veya rematch isteyin.',
        code,
      });
    }
    throw e;
  }
});

router.get('/:slug/games/xox/:roomId', async (req, res) => {
  const restaurant = await loadRestaurant(req.params.slug);
  if (!restaurant) return res.status(404).json({ message: 'Menü bulunamadı' });
  const games = await loadGamesConfig(restaurant.id);
  if (!isMenuGamesEnabled(games) || !games.xox.enabled) {
    return res.status(403).json({ message: 'Oyunlar kapalı', code: 'GAMES_OFF' });
  }
  const guestId = guestIdFrom(req);
  if (!guestId) return res.status(400).json({ message: 'guestId gerekli' });

  const roomId = decodeURIComponent(req.params.roomId);
  if (!roomId.startsWith(`${restaurant.id}:`)) {
    return res.status(404).json({ message: 'Oda bulunamadı' });
  }
  const room = getXoxRoom(roomId, guestId);
  if (!room) return res.status(404).json({ message: 'Oda bulunamadı' });
  res.json({ ok: true, room });
});

router.post('/:slug/games/xox/:roomId/move', async (req, res) => {
  const restaurant = await loadRestaurant(req.params.slug);
  if (!restaurant) return res.status(404).json({ message: 'Menü bulunamadı' });
  const games = await loadGamesConfig(restaurant.id);
  if (!isMenuGamesEnabled(games) || !games.xox.enabled) {
    return res.status(403).json({ message: 'Oyunlar kapalı', code: 'GAMES_OFF' });
  }
  const guestId = guestIdFrom(req);
  if (!guestId) return res.status(400).json({ message: 'guestId gerekli' });
  const cell = Number(req.body?.cell);
  const roomId = decodeURIComponent(req.params.roomId);
  if (!roomId.startsWith(`${restaurant.id}:`)) {
    return res.status(404).json({ message: 'Oda bulunamadı' });
  }

  try {
    const room = playXoxMove({ roomId, guestId, cell });
    if (!room) return res.status(404).json({ message: 'Oda bulunamadı' });
    res.json({ ok: true, room });
  } catch (e) {
    const code = (e as { code?: string }).code || 'MOVE_FAIL';
    const map: Record<string, string> = {
      BAD_CELL: 'Geçersiz kare',
      GAME_OVER: 'Oyun bitti',
      WAITING: 'Rakip bekleniyor',
      NOT_PLAYER: 'Bu odada değilsiniz',
      NOT_TURN: 'Sıra sizde değil',
      OCCUPIED: 'Kare dolu',
    };
    return res.status(400).json({ message: map[code] || 'Hamle yapılamadı', code });
  }
});

router.post('/:slug/games/xox/:roomId/rematch', async (req, res) => {
  const restaurant = await loadRestaurant(req.params.slug);
  if (!restaurant) return res.status(404).json({ message: 'Menü bulunamadı' });
  const games = await loadGamesConfig(restaurant.id);
  if (!isMenuGamesEnabled(games) || !games.xox.enabled) {
    return res.status(403).json({ message: 'Oyunlar kapalı', code: 'GAMES_OFF' });
  }
  const guestId = guestIdFrom(req);
  if (!guestId) return res.status(400).json({ message: 'guestId gerekli' });
  const roomId = decodeURIComponent(req.params.roomId);
  if (!roomId.startsWith(`${restaurant.id}:`)) {
    return res.status(404).json({ message: 'Oda bulunamadı' });
  }
  try {
    const room = rematchXox({ roomId, guestId });
    if (!room) return res.status(404).json({ message: 'Oda bulunamadı' });
    res.json({ ok: true, room });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'NOT_PLAYER') {
      return res.status(403).json({ message: 'Bu odada değilsiniz', code });
    }
    throw e;
  }
});

router.post('/:slug/games/xox/:roomId/leave', async (req, res) => {
  const restaurant = await loadRestaurant(req.params.slug);
  if (!restaurant) return res.status(404).json({ message: 'Menü bulunamadı' });
  const guestId = guestIdFrom(req);
  if (!guestId) return res.status(400).json({ message: 'guestId gerekli' });
  const roomId = decodeURIComponent(req.params.roomId);
  leaveXoxRoom({ roomId, guestId });
  res.json({ ok: true });
});

export default router;
