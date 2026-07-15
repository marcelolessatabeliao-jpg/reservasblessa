-- Migration: Adicionar quiosques familiares (06-12) e atualizar preços
-- Data: 2026-06-26

-- 1. Atualiza o constraint do kiosk_type na tabela kiosk_reservations para aceitar 'familiar'
ALTER TABLE kiosk_reservations
  DROP CONSTRAINT IF EXISTS kiosk_reservations_kiosk_type_check;

ALTER TABLE kiosk_reservations
  ADD CONSTRAINT kiosk_reservations_kiosk_type_check
  CHECK (kiosk_type IN ('maior', 'menor', 'familiar'));

-- 2. Atualiza preços na tabela de serviços (site_settings ou services)
-- Preço quiosque grande (maior): R$ 150,00
INSERT INTO site_settings (key, value, updated_at)
VALUES ('kiosk_maior', '150', NOW())
ON CONFLICT (key) DO UPDATE SET value = '150', updated_at = NOW();

-- Preço quiosque médio (menor): R$ 100,00
INSERT INTO site_settings (key, value, updated_at)
VALUES ('kiosk_menor', '100', NOW())
ON CONFLICT (key) DO UPDATE SET value = '100', updated_at = NOW();

-- Preço quiosque familiar: R$ 75,00
INSERT INTO site_settings (key, value, updated_at)
VALUES ('kiosk_familiar', '75', NOW())
ON CONFLICT (key) DO UPDATE SET value = '75', updated_at = NOW();
