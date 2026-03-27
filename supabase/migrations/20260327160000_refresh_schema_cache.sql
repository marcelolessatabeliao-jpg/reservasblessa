-- FORÇAR RELOAD DO SCHEMA CACHE DO POSTGREST
-- O erro "Could not find the 'product_id' column of 'order_items' in the schema cache"
-- ocorre quando o PostgREST não reconhece colunas existentes.

-- 1. Garantir que a coluna product_id existe (idempotente)
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS product_id TEXT;

-- 2. Garantir que is_redeemed existe (usada pelo admin)
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS is_redeemed BOOLEAN DEFAULT false;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS redeemed_at TIMESTAMP WITH TIME ZONE;

-- 3. Garantir notes existe em orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS notes TEXT;

-- 4. Garantir permissões de UPDATE (necessárias para admin e checkout)
DROP POLICY IF EXISTS "Anyone can update orders" ON public.orders;
CREATE POLICY "Anyone can update orders" ON public.orders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update order items" ON public.order_items;
CREATE POLICY "Anyone can update order items" ON public.order_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can delete order items" ON public.order_items;
CREATE POLICY "Anyone can delete order items" ON public.order_items FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can update vouchers" ON public.vouchers;
CREATE POLICY "Anyone can update vouchers" ON public.vouchers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can insert vouchers" ON public.vouchers;
CREATE POLICY "Anyone can insert vouchers" ON public.vouchers FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update quad reservations" ON public.quad_reservations;
CREATE POLICY "Anyone can update quad reservations" ON public.quad_reservations FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update kiosk reservations" ON public.kiosk_reservations;
CREATE POLICY "Anyone can update kiosk reservations" ON public.kiosk_reservations FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- 5. Grant completo
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;

-- 6. Forçar reload do schema
NOTIFY pgrst, 'reload schema';
