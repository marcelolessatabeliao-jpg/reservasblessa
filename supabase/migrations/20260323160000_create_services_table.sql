CREATE TABLE IF NOT EXISTS public.services (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL UNIQUE,
    base_price NUMERIC(10,2) NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

INSERT INTO public.services (name, type, base_price, ativo) VALUES
('Day Use (Inteira)', 'entry_full', 50, true),
('Day Use (Meia/Especial)', 'entry_half', 25, true),
('Quiosque Menor', 'kiosk_menor', 75, true),
('Quiosque Maior', 'kiosk_maior', 100, true),
('Quadriciclo Individual', 'quad_individual', 150, true),
('Quadriciclo Dupla', 'quad_dupla', 250, true),
('Quadriciclo Adulto+Criança', 'quad_adulto-crianca', 200, true),
('Pesca Esportiva', 'add_pesca', 20, true),
('Futebol de Sabão', 'add_futebol-sabao', 10, true)
ON CONFLICT (type) DO UPDATE SET base_price = EXCLUDED.base_price;

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active services" ON public.services FOR SELECT USING (ativo = true);
CREATE POLICY "Admin can modify services" ON public.services FOR ALL USING (true);
