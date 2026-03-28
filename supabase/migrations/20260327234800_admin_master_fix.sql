-- ==========================================================
-- FINAL DATABASE REPAIR - ADMIN FULL ACCESS & CASCADE
-- ==========================================================

-- 1. Garantir que as tabelas tenham RLS habilitado
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kiosk_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quad_reservations ENABLE ROW LEVEL SECURITY;

-- 2. RESET das políticas para o Admin (Liberar tudo para anon e authenticated)
DO $$ 
DECLARE 
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Admin Full Access" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Admin Full Access" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', t);
        
        -- Garante permissões básicas de acesso
        EXECUTE format('GRANT ALL ON TABLE public.%I TO anon, authenticated', t);
    END LOOP;
END $$;

-- 3. Corrigir FKs para CASCADE DELETE (Crucial para conseguir apagar reservas)
-- Isso permite que ao deletar uma reserva, todos os itens, pagamentos e vouchers relacionados sumam automaticamente.

-- Para ORDENS
ALTER TABLE public.order_items 
  DROP CONSTRAINT IF EXISTS order_items_order_id_fkey,
  ADD CONSTRAINT order_items_order_id_fkey 
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

ALTER TABLE public.payments 
  DROP CONSTRAINT IF EXISTS payments_order_id_fkey,
  ADD CONSTRAINT payments_order_id_fkey 
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

ALTER TABLE public.vouchers 
  DROP CONSTRAINT IF EXISTS vouchers_order_id_fkey,
  ADD CONSTRAINT vouchers_order_id_fkey 
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

-- Para Kiosk/Quad vinculados a Ordens (se houver)
ALTER TABLE public.kiosk_reservations 
  DROP CONSTRAINT IF EXISTS kiosk_reservations_order_id_fkey,
  ADD CONSTRAINT kiosk_reservations_order_id_fkey 
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

ALTER TABLE public.quad_reservations 
  DROP CONSTRAINT IF EXISTS quad_reservations_order_id_fkey,
  ADD CONSTRAINT quad_reservations_order_id_fkey 
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

-- 4. Garantir colunas essenciais
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE public.kiosk_reservations ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE public.quad_reservations ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- 5. Conceder permissões de sequência (caso use serial IDs)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- ==========================================================
-- 6. CRIAR O BUCKET DE COMPROVANTES (RECEIPTS)
-- Resolve o problema: "Erro ao anexar comprovante"
-- ==========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Garantir que a tabela storage.objects tenha as permissões abertas para os comprovantes
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "allow_all_receipts_select" ON storage.objects;
    DROP POLICY IF EXISTS "allow_all_receipts_insert" ON storage.objects;
    DROP POLICY IF EXISTS "allow_all_receipts_update" ON storage.objects;
    DROP POLICY IF EXISTS "allow_all_receipts_delete" ON storage.objects;
EXCEPTION WHEN undefined_object THEN
    -- Ignore
END $$;

CREATE POLICY "allow_all_receipts_select" ON storage.objects FOR SELECT USING (bucket_id = 'receipts');
CREATE POLICY "allow_all_receipts_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'receipts');
CREATE POLICY "allow_all_receipts_update" ON storage.objects FOR UPDATE USING (bucket_id = 'receipts');
CREATE POLICY "allow_all_receipts_delete" ON storage.objects FOR DELETE USING (bucket_id = 'receipts');

-- ==========================================================
-- FIM DO SCRIPT - POR FAVOR, EXECUTE NO SQL EDITOR DO SUPABASE
-- ==========================================================
