-- Create vouchers table if not exists
CREATE TABLE IF NOT EXISTS public.vouchers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    qr_code_url TEXT,
    status TEXT DEFAULT 'active',
    is_redeemed BOOLEAN DEFAULT false,
    redeemed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public can view vouchers" ON public.vouchers FOR SELECT TO public USING (true);
CREATE POLICY "Admin can update vouchers" ON public.vouchers FOR UPDATE TO public USING (true);
