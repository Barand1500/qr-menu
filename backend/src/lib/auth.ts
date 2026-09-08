import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { prisma } from './prisma.js';
import { getLanguages, getProductField } from './i18n-json.js';
import { parseProductImages } from './product-images.js';

export interface AuthPayload {
  userId: number;
  restaurantId: number;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' });
}

export function authRequired(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Oturum gerekli' });
  }

  void (async () => {
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as AuthPayload;
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { isActive: true, restaurantId: true, role: true, email: true },
      });
      if (!user || !user.isActive) {
        return res.status(401).json({ message: 'Oturum geçersiz veya hesap pasif' });
      }
      req.user = {
        userId: decoded.userId,
        restaurantId: user.restaurantId,
        email: user.email,
        role: user.role,
      };
      next();
    } catch {
      return res.status(401).json({ message: 'Geçersiz oturum' });
    }
  })();
}

export async function getRestaurantId(req: Request): Promise<number | null> {
  return req.user?.restaurantId ?? null;
}

export async function validateProduct(productId: number, restaurantId: number) {
  const product = await prisma.product.findFirst({
    where: { id: productId, restaurantId },
  });
  if (!product) return { valid: false, issues: ['Ürün bulunamadı'] };

  const issues: string[] = [];
  const images = parseProductImages(product);
  if (images.length === 0) issues.push('Görsel eksik');
  if (Number(product.price) <= 0) issues.push('Fiyat geçersiz');

  const activeLanguages = (await getLanguages()).filter((l) => l.isActive);
  for (const lang of activeLanguages) {
    const name = getProductField(product.i18n, lang.code, 'name');
    if (!name) issues.push(`${lang.code} çeviri eksik`);
  }

  return { valid: issues.length === 0, issues };
}
