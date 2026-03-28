-- ADMIN MASTER PERMISSIONS FIX
-- Este script libera as permissões de SELECT, INSERT, UPDATE e DELETE para o Dashboard Administrativo (anon/authenticated)

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
        -- Grant general access
        EXECUTE format('GRANT ALL ON TABLE public.%I TO anon, authenticated', t);
        
        -- Enable RLS (ensure it is on)
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        
        -- Create/Replace master policy for each table
        EXECUTE format('DROP POLICY IF EXISTS "Admin Full Access" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Admin Full Access" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', t);
    END LOOP;
END $$;

-- Garantir colunas de comprovante em tudo (caso não tenha rodado antes)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE kiosk_reservations ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE quad_reservations ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- Corrigir constraints de deleção (Cascade)
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
