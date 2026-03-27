
-- PERMISSÕES DE EXCLUSÃO PARA ADMIN (Bypass para Dashboard)

-- 1. Quadriciclos
DROP POLICY IF EXISTS "Anyone can delete quad reservations" ON public.quad_reservations;
CREATE POLICY "Anyone can delete quad reservations" ON public.quad_reservations FOR DELETE TO anon, authenticated USING (true);

-- 2. Quiosques
DROP POLICY IF EXISTS "Anyone can delete kiosk reservations" ON public.kiosk_reservations;
CREATE POLICY "Anyone can delete kiosk reservations" ON public.kiosk_reservations FOR DELETE TO anon, authenticated USING (true);

-- 3. Itens do Pedido
DROP POLICY IF EXISTS "Anyone can delete order items" ON public.order_items;
CREATE POLICY "Anyone can delete order items" ON public.order_items FOR DELETE TO anon, authenticated USING (true);

-- 4. Pedidos (Orders)
DROP POLICY IF EXISTS "Anyone can delete orders" ON public.orders;
CREATE POLICY "Anyone can delete orders" ON public.orders FOR DELETE TO anon, authenticated USING (true);

-- 5. Bookings (Legado)
DROP POLICY IF EXISTS "Anyone can delete bookings" ON public.bookings;
CREATE POLICY "Anyone can delete bookings" ON public.bookings FOR DELETE TO anon, authenticated USING (true);

-- 6. Vouchers e Pagamentos (Para limpeza completa)
DROP POLICY IF EXISTS "Anyone can delete vouchers" ON public.vouchers;
CREATE POLICY "Anyone can delete vouchers" ON public.vouchers FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can delete payments" ON public.payments;
CREATE POLICY "Anyone can delete payments" ON public.payments FOR DELETE TO anon, authenticated USING (true);
