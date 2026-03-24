-- Adicionar suporte para resgate individual de itens
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS is_redeemed BOOLEAN DEFAULT false;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS redeemed_at TIMESTAMP WITH TIME ZONE;
