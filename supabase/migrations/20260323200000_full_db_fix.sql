-- COMPLETO DATABASE FIX PARA CHECKOUT (Sincronização Dashboard)

-- 1. Garantir que a tabela bookings tenha as colunas necessárias
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS confirmation_code TEXT;

-- 2. Tabela Orders (Pedidos)
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    customer_name TEXT,
    total_amount DECIMAL(10,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Adicionar booking_id se não existir
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='booking_id') THEN
        ALTER TABLE public.orders ADD COLUMN booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Tabela Order Items (Itens do Pedido)
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 4. Tabela Payments (Pagamentos)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    gateway TEXT NOT NULL DEFAULT 'asaas',
    metodo TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    external_id TEXT,
    payment_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 5. Tabela Vouchers
CREATE TABLE IF NOT EXISTS public.vouchers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    qr_code_url TEXT,
    status TEXT DEFAULT 'active',
    is_redeemed BOOLEAN DEFAULT false,
    redeemed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso Público (Insert para convidados)
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
CREATE POLICY "Anyone can create orders" ON public.orders FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;
CREATE POLICY "Anyone can create order items" ON public.order_items FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can create payments" ON public.payments;
CREATE POLICY "Anyone can create payments" ON public.payments FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Políticas de Visualização
DROP POLICY IF EXISTS "Public view orders" ON public.orders;
CREATE POLICY "Public view orders" ON public.orders FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public view order items" ON public.order_items;
CREATE POLICY "Public view order items" ON public.order_items FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public view payments" ON public.payments;
CREATE POLICY "Public view payments" ON public.payments FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public view vouchers" ON public.vouchers;
CREATE POLICY "Public view vouchers" ON public.vouchers FOR SELECT TO anon, authenticated USING (true);

-- Garantir que a tabela services tenha a coluna ativo
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true;
