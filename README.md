# Menu QR

Modern dijital menü yönetim sistemi — admin panel, QR müşteri menüsü, MySQL veritabanı.

## Gereksinimler

- Node.js 20+
- MySQL 8 (localhost:3306)

## Kurulum

```bash
# Kök dizinde
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# Veritabanı (MySQL'de qrmenu DB oluşturulur)
cd backend
npm run db:push
npm run db:seed
```

## Geliştirme

```bash
# Kök dizinden (backend + frontend birlikte)
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Giriş: `admin@guzelteknoloji.com` / `123456`
- Public menü: http://localhost:5173/m/zeen-lounge

## Ortam Değişkenleri

Backend `.env`:
```
DATABASE_URL=mysql://root:SIFRE@127.0.0.1:3306/qrmenu
JWT_SECRET=...
PORT=3001
```

## Electron (.exe)

```bash
cd frontend && npm run build
cd ../electron && npm install && npm run build
```

## Proje Yapısı

- `frontend/` — React + Vite + Tailwind
- `backend/` — Express + Prisma + MySQL
- `electron/` — Masaüstü sarmalayıcı
- `database/` — SQL referans
