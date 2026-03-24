-- Link orders to bookings
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL;

-- Ensure payments table is correct as per prompt
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    gateway TEXT NOT NULL DEFAULT 'asaas',
    metodo TEXT NOT NULL, -- pix, cartao, local
    status TEXT NOT NULL DEFAULT 'pending',
    external_id TEXT, -- Asaas payment id
    payment_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
