-- Create internal_credits table
CREATE TABLE IF NOT EXISTS public.internal_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    customer_cpf TEXT,
    amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    used_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.internal_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin access" ON public.internal_credits
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_internal_credits_updated_at
    BEFORE UPDATE ON public.internal_credits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
