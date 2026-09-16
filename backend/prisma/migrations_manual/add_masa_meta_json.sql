-- Masa oturumu meta (pax / not / garson / hesap indirimi)
-- phpMyAdmin veya mysql CLI ile çalıştırın:

USE `guzelteknoloji-menu-db`;

ALTER TABLE masa_oturumlari
  ADD COLUMN meta_json TEXT NULL AFTER odeme_json;
