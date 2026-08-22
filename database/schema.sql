-- Menu QR veritabanı referans şeması
-- Prisma db push ile otomatik oluşturulur; bu dosya dokümantasyon amaçlıdır.

CREATE DATABASE IF NOT EXISTS qrmenu CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE qrmenu;

-- Tablolar Prisma tarafından yönetilir.
-- Seed: npm run db:seed (backend klasöründe)

-- Gruplar (groups) — ana grup / alt grup hiyerarşisi
-- ust_grup_id: NULL = ana grup, dolu = alt grup (üst grubun id'si)
-- sort_order: menüde görünme sırası
-- is_active: menüde aktif mi
