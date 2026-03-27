
-- GARANTIR PERMISSÕES TOTAIS PARA PEDIDOS E ITENS (PROVISÓRIO PARA CORREÇÃO)

-- 1. Orders
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
CREATE POLICY "Anyone can create orders" ON public.orders FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Public view orders" ON public.orders;
CREATE POLICY "Public view orders" ON public.orders FOR SELECT TO anon, authenticated USING (true);

-- 2. Order Items
DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;
CREATE POLICY "Anyone can create order items" ON public.order_items FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Public view order items" ON public.order_items;
CREATE POLICY "Public view order items" ON public.order_items FOR SELECT TO anon, authenticated USING (true);

-- 3. Reservations (Quad/Kiosk)
DROP POLICY IF EXISTS "Anyone can create quad reservations" ON public.quad_reservations;
CREATE POLICY "Anyone can create quad reservations" ON public.quad_reservations FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can read quad reservations" ON public.quad_reservations;
CREATE POLICY "Anyone can read quad reservations" ON public.quad_reservations FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can create kiosk reservations" ON public.kiosk_reservations;
CREATE POLICY "Anyone can create kiosk reservations" ON public.kiosk_reservations FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can read kiosk reservations" ON public.kiosk_reservations;
CREATE POLICY "Anyone can read kiosk reservations" ON public.kiosk_reservations FOR SELECT TO anon, authenticated USING (true);

-- 4. Enable All columns visibility if possible
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT INSERT ON ALL TABLES IN SCHEMA public TO anon;
