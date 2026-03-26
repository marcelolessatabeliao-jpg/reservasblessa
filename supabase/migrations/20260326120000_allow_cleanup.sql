-- 1. Políticas temporais para limpeza de dados (Dashboard)
-- ATENÇÃO: Essas políticas devem ser removidas após a limpeza se a segurança for crítica.
CREATE POLICY "Enable delete for anyone" ON public.orders FOR DELETE TO anon USING (true);
CREATE POLICY "Enable delete for anyone items" ON public.order_items FOR DELETE TO anon USING (true);
CREATE POLICY "Enable delete for anyone bookings" ON public.bookings FOR DELETE TO anon USING (true);
CREATE POLICY "Enable delete for anyone payments" ON public.payments FOR DELETE TO anon USING (true);
CREATE POLICY "Enable delete for anyone vouchers" ON public.vouchers FOR DELETE TO anon USING (true);
