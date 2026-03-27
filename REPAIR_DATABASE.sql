
-- ==========================================================
-- REPAIR_DATABASE.sql
-- Balneário Lessa - Restauração de Tabelas e Colunas Faltantes
-- ==========================================================

-- 1. Restaurar Colunas Faltantes em ORDER_ITEMS
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS product_id TEXT NOT NULL DEFAULT 'Item Indefinido';
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS unit_price DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS is_redeemed BOOLEAN DEFAULT false;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS redeemed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL;

-- 2. Recriar Tabela QUAD_RESERVATIONS
CREATE TABLE IF NOT EXISTS public.quad_reservations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    quad_type TEXT NOT NULL,
    reservation_date DATE NOT NULL,
    time_slot TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Recriar Tabela KIOSK_RESERVATIONS
CREATE TABLE IF NOT EXISTS public.kiosk_reservations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    kiosk_type TEXT NOT NULL,
    reservation_date DATE NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Habilitar RLS e Permissões de Acesso (Garantir que todos funcionem)
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quad_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kiosk_reservations ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de Inserção (Checkout Público)
DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;
CREATE POLICY "Anyone can create order items" ON public.order_items FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can create quad reservations" ON public.quad_reservations;
CREATE POLICY "Anyone can create quad reservations" ON public.quad_reservations FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can create kiosk reservations" ON public.kiosk_reservations;
CREATE POLICY "Anyone can create kiosk reservations" ON public.kiosk_reservations FOR INSERT TO anon, authenticated WITH CHECK (true);

-- 6. Políticas de Visualização (Dashboard / Inventário)
DROP POLICY IF EXISTS "Public view order items" ON public.order_items;
CREATE POLICY "Public view order items" ON public.order_items FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can read quad reservations" ON public.quad_reservations;
CREATE POLICY "Anyone can read quad reservations" ON public.quad_reservations FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can read kiosk reservations" ON public.kiosk_reservations;
CREATE POLICY "Anyone can read kiosk reservations" ON public.kiosk_reservations FOR SELECT TO anon, authenticated USING (true);

-- 7. Garantir Deleção Total pelo Admin (Políticas de Deletar)
DROP POLICY IF EXISTS "Enable delete for anyone items" ON public.order_items;
CREATE POLICY "Enable delete for anyone items" ON public.order_items FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can delete quad reservations" ON public.quad_reservations;
CREATE POLICY "Anyone can delete quad reservations" ON public.quad_reservations FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can delete kiosk reservations" ON public.kiosk_reservations;
CREATE POLICY "Anyone can delete kiosk reservations" ON public.kiosk_reservations FOR DELETE TO anon, authenticated USING (true);

-- 8. Conceder permissões para ANON
GRANT SELECT, INSERT, DELETE ON ALL TABLES IN SCHEMA public TO anon;

-- ==========================================================
-- FIM DO REPARO
-- ==========================================================
