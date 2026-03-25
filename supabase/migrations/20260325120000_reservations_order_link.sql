
-- Adicionar order_id às tabelas de reserva para unificação completa
ALTER TABLE public.quad_reservations ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE;
ALTER TABLE public.kiosk_reservations ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_quad_reservations_order_id ON public.quad_reservations(order_id);
CREATE INDEX IF NOT EXISTS idx_kiosk_reservations_order_id ON public.kiosk_reservations(order_id);
