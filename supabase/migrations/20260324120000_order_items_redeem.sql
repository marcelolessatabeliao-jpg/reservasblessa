-- 1. Adicionar colunas de redenção (check-in) na tabela order_items para controle granular
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS is_redeemed BOOLEAN DEFAULT false;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS redeemed_at TIMESTAMP WITH TIME ZONE;

-- 2. Garantir que o Administrador possa atualizar esses campos
DROP POLICY IF EXISTS "Anyone can update order_items" ON public.order_items;
CREATE POLICY "Anyone can update order_items" ON public.order_items 
FOR UPDATE TO anon, authenticated 
USING (true)
WITH CHECK (true);
