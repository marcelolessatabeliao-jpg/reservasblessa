CREATE TABLE IF NOT EXISTS public.payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    gateway TEXT NOT NULL DEFAULT 'asaas',
    metodo TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    external_id TEXT,
    payment_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilita Row Level Security
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Public can insert payments" 
ON public.payments FOR INSERT 
TO public 
WITH CHECK (true);

CREATE POLICY "Public can view payments" 
ON public.payments FOR SELECT 
TO public 
USING (true);

CREATE POLICY "Admin can update payments" 
ON public.payments FOR UPDATE 
TO public 
USING (true);
