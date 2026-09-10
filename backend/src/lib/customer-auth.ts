import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { prisma } from './prisma.js';

export type CustomerAuthPayload = {
  typ: 'customer';
  customerId: number;
};

declare global {
  namespace Express {
    interface Request {
      customer?: CustomerAuthPayload;
    }
  }
}

export function signCustomerToken(customerId: number, remember = false): string {
  return jwt.sign(
    { typ: 'customer', customerId } satisfies CustomerAuthPayload,
    config.jwtSecret,
    { expiresIn: remember ? '30d' : '7d' }
  );
}

export function customerAuthRequired(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ message: 'Oturum gerekli' });
  }

  void (async () => {
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as CustomerAuthPayload & {
        typ?: string;
      };
      if (decoded.typ !== 'customer' || !decoded.customerId) {
        return res.status(401).json({ message: 'Geçersiz oturum' });
      }
      const row = await prisma.menuCustomer.findUnique({
        where: { id: decoded.customerId },
        select: { id: true },
      });
      if (!row) {
        return res.status(401).json({ message: 'Oturum geçersiz' });
      }
      req.customer = { typ: 'customer', customerId: row.id };
      next();
    } catch {
      return res.status(401).json({ message: 'Geçersiz oturum' });
    }
  })();
}

export function normalizeEmail(raw: string) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .slice(0, 150);
}

/** TR telefon → sadece rakam, baştaki 0/90 sadeleştir */
export function normalizePhone(raw: string) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('90') && digits.length >= 12) digits = digits.slice(2);
  if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);
  return digits.slice(0, 15);
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPhone(phone: string) {
  return /^5\d{9}$/.test(phone);
}

export function asStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, 40);
}

export function parsePointsJson(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) out[String(k)] = Math.round(n);
  }
  return out;
}

export function customerPublic(row: {
  id: number;
  email: string | null;
  phone: string | null;
  fullName: string;
  allergenTags: unknown;
  dietTags: unknown;
  likedFoods: unknown;
  dislikedFoods: unknown;
  drinksAlcohol?: boolean | null;
  pointsJson: unknown;
  kvkkAcceptedAt: Date;
}) {
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    fullName: row.fullName,
    allergenTags: asStringArray(row.allergenTags),
    dietTags: asStringArray(row.dietTags),
    likedFoods: asStringArray(row.likedFoods),
    dislikedFoods: asStringArray(row.dislikedFoods),
    drinksAlcohol:
      row.drinksAlcohol === true ? true : row.drinksAlcohol === false ? false : null,
    pointsByRestaurant: parsePointsJson(row.pointsJson),
    kvkkAcceptedAt: row.kvkkAcceptedAt.toISOString(),
  };
}
