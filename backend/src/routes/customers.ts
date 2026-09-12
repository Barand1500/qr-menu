import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authRequired, getRestaurantId } from '../lib/auth.js';
import { parsePointsJson } from '../lib/customer-auth.js';
import {
  getCustomerDebtBalance,
  getDebtBalances,
  getRestaurantDiscount,
  getRestaurantPoints,
  loadPointsRewards,
  normalizePointsRewards,
  parseDiscountsJson,
  savePointsRewards,
  serializeDiscountsJson,
  type CustomerDiscount,
} from '../lib/customer-admin.js';
import { lookupCustomerQrChallenge } from '../lib/customer-qr-challenge.js';

const router = Router();
router.use(authRequired);

function serializeCustomerRow(
  row: {
    id: number;
    email: string | null;
    phone: string | null;
    fullName: string;
    pointsJson: unknown;
    discountsJson: unknown;
    createdAt: Date;
    updatedAt: Date;
  },
  restaurantId: number,
  debtBalance: number
) {
  const discount = getRestaurantDiscount(row.discountsJson, restaurantId);
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    points: getRestaurantPoints(row.pointsJson, restaurantId),
    discount,
    debtBalance,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeLedger(entry: {
  id: number;
  kind: string;
  amount: number;
  note: string | null;
  balanceAfter: number | null;
  pointsAfter: number | null;
  metaJson?: unknown;
  createdAt: Date;
}) {
  return {
    id: entry.id,
    kind: entry.kind,
    amount: entry.amount,
    note: entry.note,
    balanceAfter: entry.balanceAfter,
    pointsAfter: entry.pointsAfter,
    meta: entry.metaJson ?? null,
    createdAt: entry.createdAt.toISOString(),
  };
}

router.get('/points-rewards', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  if (restaurantId == null) return res.status(401).json({ message: 'Yetkisiz' });
  const rules = await loadPointsRewards(restaurantId);
  res.json({ rules });
});

router.put('/points-rewards', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  if (restaurantId == null) return res.status(401).json({ message: 'Yetkisiz' });
  const rules = await savePointsRewards(
    restaurantId,
    normalizePointsRewards(req.body?.rules ?? req.body)
  );
  res.json({ rules });
});

router.get('/', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  if (restaurantId == null) return res.status(401).json({ message: 'Yetkisiz' });

  const q = String(req.query.search || req.query.q || '')
    .trim()
    .slice(0, 80);
  const filter = String(req.query.filter || 'all');
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '40'), 10) || 40));

  const allBalances = await getDebtBalances(restaurantId);
  const debtorIds: number[] = [];
  for (const [id, bal] of allBalances) {
    if (bal > 0.009) debtorIds.push(id);
  }
  const debtorCount = debtorIds.length;

  const where: Prisma.MenuCustomerWhereInput = {};
  if (filter === 'debtors') {
    if (debtorIds.length === 0) {
      return res.json({
        data: [],
        debtorCount: 0,
        pagination: { page, limit, total: 0 },
      });
    }
    where.id = { in: debtorIds };
  }
  if (q) {
    where.OR = [
      { fullName: { contains: q } },
      { email: { contains: q } },
      { phone: { contains: q.replace(/\D/g, '') || q } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.menuCustomer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        email: true,
        phone: true,
        fullName: true,
        pointsJson: true,
        discountsJson: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.menuCustomer.count({ where }),
  ]);

  const data = rows.map((r) =>
    serializeCustomerRow(r, restaurantId, allBalances.get(r.id) || 0)
  );

  res.json({
    data,
    debtorCount,
    pagination: { page, limit, total },
  });
});

router.post('/lookup', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  if (restaurantId == null) return res.status(401).json({ message: 'Yetkisiz' });

  const result = lookupCustomerQrChallenge({
    code: req.body?.code,
    qr: req.body?.qr || req.body?.payload,
  });
  if ('error' in result) {
    return res.status(result.status).json({ message: result.error });
  }

  const row = await prisma.menuCustomer.findUnique({
    where: { id: result.customerId },
    select: {
      id: true,
      email: true,
      phone: true,
      fullName: true,
      pointsJson: true,
      discountsJson: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!row) return res.status(404).json({ message: 'Müşteri bulunamadı' });

  const debtBalance = await getCustomerDebtBalance(restaurantId, row.id);
  res.json({
    customerId: row.id,
    customer: serializeCustomerRow(row, restaurantId, debtBalance),
  });
});

router.get('/:id', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  if (restaurantId == null) return res.status(401).json({ message: 'Yetkisiz' });
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'Geçersiz müşteri' });

  const row = await prisma.menuCustomer.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      phone: true,
      fullName: true,
      pointsJson: true,
      discountsJson: true,
      allergenTags: true,
      dietTags: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!row) return res.status(404).json({ message: 'Müşteri bulunamadı' });

  const debtBalance = await getCustomerDebtBalance(restaurantId, id);
  const ledgerPage = Math.max(1, parseInt(String(req.query.ledgerPage || '1'), 10) || 1);
  const ledgerLimit = Math.min(
    50,
    Math.max(1, parseInt(String(req.query.ledgerLimit || '8'), 10) || 8)
  );
  const ledgerWhere = { restaurantId, customerId: id };
  const [ledger, ledgerTotal] = await Promise.all([
    prisma.menuCustomerLedger.findMany({
      where: ledgerWhere,
      orderBy: { createdAt: 'desc' },
      skip: (ledgerPage - 1) * ledgerLimit,
      take: ledgerLimit,
    }),
    prisma.menuCustomerLedger.count({ where: ledgerWhere }),
  ]);

  res.json({
    customer: {
      ...serializeCustomerRow(row, restaurantId, debtBalance),
      allergenTags: row.allergenTags,
      dietTags: row.dietTags,
    },
    ledger: ledger.map(serializeLedger),
    ledgerPagination: { page: ledgerPage, limit: ledgerLimit, total: ledgerTotal },
  });
});

router.delete('/:id', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  if (restaurantId == null || !req.user?.userId) {
    return res.status(401).json({ message: 'Yetkisiz' });
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'Geçersiz müşteri' });

  const password = String(req.body?.password || '');
  if (!password) return res.status(400).json({ message: 'Şifre gerekli' });

  const admin = await prisma.user.findUnique({ where: { id: req.user.userId } });
  if (!admin || admin.restaurantId !== restaurantId) {
    return res.status(401).json({ message: 'Yetkisiz' });
  }
  const ok = await bcrypt.compare(password, admin.passwordHash);
  if (!ok) return res.status(403).json({ message: 'Şifre hatalı' });

  const row = await prisma.menuCustomer.findUnique({ where: { id }, select: { id: true } });
  if (!row) return res.status(404).json({ message: 'Müşteri bulunamadı' });

  await prisma.menuCustomer.delete({ where: { id } });
  res.json({ ok: true, permanent: true });
});

router.post('/:id/undo', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  if (restaurantId == null) return res.status(401).json({ message: 'Yetkisiz' });
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'Geçersiz müşteri' });

  const last = await prisma.menuCustomerLedger.findFirst({
    where: { restaurantId, customerId: id },
    orderBy: { createdAt: 'desc' },
  });
  if (!last) return res.status(400).json({ message: 'Geri alınacak işlem yok' });

  const customer = await prisma.menuCustomer.findUnique({ where: { id } });
  if (!customer) return res.status(404).json({ message: 'Müşteri bulunamadı' });

  if (last.kind === 'points') {
    const map = parsePointsJson(customer.pointsJson);
    const key = String(restaurantId);
    const current = map[key] ?? 0;
    map[key] = Math.max(0, Math.round(current - Number(last.amount)));
    await prisma.menuCustomer.update({ where: { id }, data: { pointsJson: map } });
  } else if (last.kind === 'discount') {
    const map = parseDiscountsJson(customer.discountsJson);
    const key = String(restaurantId);
    const meta =
      last.metaJson && typeof last.metaJson === 'object' && !Array.isArray(last.metaJson)
        ? (last.metaJson as { previous?: CustomerDiscount | null })
        : {};
    if (meta.previous && meta.previous.value > 0) map[key] = meta.previous;
    else delete map[key];
    await prisma.menuCustomer.update({
      where: { id },
      data: { discountsJson: serializeDiscountsJson(map) as object },
    });
  }

  await prisma.menuCustomerLedger.delete({ where: { id: last.id } });

  const updated = await prisma.menuCustomer.findUnique({ where: { id } });
  const debtBalance = await getCustomerDebtBalance(restaurantId, id);
  const ledgerWhere = { restaurantId, customerId: id };
  const ledgerLimit = 8;
  const [ledger, ledgerTotal] = await Promise.all([
    prisma.menuCustomerLedger.findMany({
      where: ledgerWhere,
      orderBy: { createdAt: 'desc' },
      take: ledgerLimit,
    }),
    prisma.menuCustomerLedger.count({ where: ledgerWhere }),
  ]);

  res.json({
    ok: true,
    customer: serializeCustomerRow(updated!, restaurantId, debtBalance),
    ledger: ledger.map(serializeLedger),
    ledgerPagination: { page: 1, limit: ledgerLimit, total: ledgerTotal },
  });
});

router.patch('/:id/points', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  if (restaurantId == null) return res.status(401).json({ message: 'Yetkisiz' });
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'Geçersiz müşteri' });

  const row = await prisma.menuCustomer.findUnique({ where: { id } });
  if (!row) return res.status(404).json({ message: 'Müşteri bulunamadı' });

  const map = parsePointsJson(row.pointsJson);
  const key = String(restaurantId);
  const current = map[key] ?? 0;
  let next = current;
  const setRaw = req.body?.set;
  const deltaRaw = req.body?.delta;
  if (setRaw !== undefined && setRaw !== null && setRaw !== '') {
    next = Math.max(0, Math.round(Number(setRaw)));
  } else if (deltaRaw !== undefined && deltaRaw !== null && deltaRaw !== '') {
    next = Math.max(0, Math.round(current + Number(deltaRaw)));
  } else {
    return res.status(400).json({ message: 'Puan değeri gerekli' });
  }
  if (!Number.isFinite(next)) return res.status(400).json({ message: 'Geçersiz puan' });

  map[key] = next;
  const note =
    typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 300) : '';

  const updated = await prisma.menuCustomer.update({
    where: { id },
    data: { pointsJson: map },
  });

  const delta = next - current;
  if (delta !== 0) {
    await prisma.menuCustomerLedger.create({
      data: {
        restaurantId,
        customerId: id,
        kind: 'points',
        amount: delta,
        note: note || (delta > 0 ? `+${delta} puan` : `${delta} puan`),
        pointsAfter: next,
        createdByUserId: req.user?.userId ?? null,
      },
    });
  }

  const debtBalance = await getCustomerDebtBalance(restaurantId, id);
  res.json({
    customer: serializeCustomerRow(updated, restaurantId, debtBalance),
  });
});

router.patch('/:id/discount', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  if (restaurantId == null) return res.status(401).json({ message: 'Yetkisiz' });
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'Geçersiz müşteri' });

  const row = await prisma.menuCustomer.findUnique({ where: { id } });
  if (!row) return res.status(404).json({ message: 'Müşteri bulunamadı' });

  const type: 'percent' | 'amount' = req.body?.type === 'amount' ? 'amount' : 'percent';
  const value = Number(req.body?.value ?? req.body?.percent ?? req.body?.amount ?? 0);
  if (!Number.isFinite(value) || value < 0) {
    return res.status(400).json({ message: 'İndirim değeri geçersiz' });
  }
  if (type === 'percent' && value > 100) {
    return res.status(400).json({ message: 'Yüzde indirim 0–100 olmalı' });
  }
  const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 200) : '';
  const expiresAt =
    typeof req.body?.expiresAt === 'string' && req.body.expiresAt.trim()
      ? req.body.expiresAt.trim()
      : null;

  const map = parseDiscountsJson(row.discountsJson);
  const key = String(restaurantId);
  const previous = map[key] || null;
  if (value <= 0) delete map[key];
  else map[key] = { type, value, note, expiresAt };

  const updated = await prisma.menuCustomer.update({
    where: { id },
    data: { discountsJson: serializeDiscountsJson(map) as object },
  });

  await prisma.menuCustomerLedger.create({
    data: {
      restaurantId,
      customerId: id,
      kind: 'discount',
      amount: value,
      note:
        note ||
        (value <= 0
          ? 'İndirim kaldırıldı'
          : type === 'amount'
            ? `${value}₺ indirim`
            : `%${value} indirim`),
      metaJson: { previous, next: value <= 0 ? null : { type, value, note, expiresAt } },
      createdByUserId: req.user?.userId ?? null,
    },
  });

  const debtBalance = await getCustomerDebtBalance(restaurantId, id);
  res.json({
    customer: serializeCustomerRow(updated, restaurantId, debtBalance),
  });
});

router.post('/:id/debt', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  if (restaurantId == null) return res.status(401).json({ message: 'Yetkisiz' });
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'Geçersiz müşteri' });

  const amount = Math.round(Number(req.body?.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ message: 'Borç tutarı geçersiz' });
  }
  const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 300) : '';

  const row = await prisma.menuCustomer.findUnique({ where: { id } });
  if (!row) return res.status(404).json({ message: 'Müşteri bulunamadı' });

  const prev = await getCustomerDebtBalance(restaurantId, id);
  const balanceAfter = Math.round((prev + amount) * 100) / 100;

  const entry = await prisma.menuCustomerLedger.create({
    data: {
      restaurantId,
      customerId: id,
      kind: 'debt',
      amount,
      note: note || 'Borç eklendi',
      balanceAfter,
      createdByUserId: req.user?.userId ?? null,
    },
  });

  res.json({
    entry: serializeLedger(entry),
    debtBalance: balanceAfter,
  });
});

router.post('/:id/payment', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  if (restaurantId == null) return res.status(401).json({ message: 'Yetkisiz' });
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'Geçersiz müşteri' });

  const amount = Math.round(Number(req.body?.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ message: 'Ödeme tutarı geçersiz' });
  }
  const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 300) : '';

  const row = await prisma.menuCustomer.findUnique({ where: { id } });
  if (!row) return res.status(404).json({ message: 'Müşteri bulunamadı' });

  const prev = await getCustomerDebtBalance(restaurantId, id);
  if (prev <= 0) return res.status(400).json({ message: 'Açık borç yok' });
  const pay = Math.min(amount, prev);
  const balanceAfter = Math.round((prev - pay) * 100) / 100;

  const entry = await prisma.menuCustomerLedger.create({
    data: {
      restaurantId,
      customerId: id,
      kind: 'payment',
      amount: pay,
      note: note || (balanceAfter <= 0 ? 'Borç kapatıldı' : 'Ödeme alındı'),
      balanceAfter,
      createdByUserId: req.user?.userId ?? null,
    },
  });

  res.json({
    entry: serializeLedger(entry),
    debtBalance: balanceAfter,
  });
});

export default router;
