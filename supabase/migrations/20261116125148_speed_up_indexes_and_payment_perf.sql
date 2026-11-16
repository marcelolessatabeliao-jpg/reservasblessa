-- OTIMIZAÇÃO CRÍTICA DE PERFORMANCE E ÍNDICES PARA ELIMINAR STATEMENT TIMEOUT
-- Cria índices essenciais nas tabelas orders, order_items e payments

CREATE INDEX IF NOT EXISTS idx_orders_confirmation_code ON public.orders(confirmation_code);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_visit_date ON public.orders(visit_date);
CREATE INDEX IF NOT EXISTS idx_orders_customer_cpf ON public.orders(customer_cpf);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_external_id ON public.payments(external_id);
