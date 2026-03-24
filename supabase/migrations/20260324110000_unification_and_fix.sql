-- 1. UNIFICAR ESTRUTURA PARA 'ORDERS'
-- Garantir que a tabela orders tenha tudo o que a antiga bookings tinha

-- Adicionar colunas necessárias na orders (e garantir que o FK bookings não impeça nada)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS visit_date DATE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS confirmation_code TEXT;

-- 2. FUNÇÃO E TRIGGER PARA CÓDIGO DE CONFIRMAÇÃO NA ORDERS
CREATE OR REPLACE FUNCTION public.generate_order_confirmation_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  IF NEW.confirmation_code IS NULL THEN
    LOOP
      new_code := UPPER(SUBSTRING(MD5(gen_random_uuid()::TEXT) FROM 1 FOR 6));
      SELECT EXISTS(SELECT 1 FROM public.orders WHERE confirmation_code = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    NEW.confirmation_code := new_code;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_order_confirmation_code ON public.orders;
CREATE TRIGGER set_order_confirmation_code
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_order_confirmation_code();

-- 3. CRIAR TABELA BOOKINGS (PARA COMPATIBILIDADE)
-- O SQL anterior falhou com PGRST205 pois bookings sumiu. Vamos criá-la decentemente.
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    visit_date DATE NOT NULL,
    phone TEXT,
    adults INTEGER DEFAULT 0,
    children JSONB DEFAULT '[]'::jsonb,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'pending',
    confirmation_code TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS na bookings
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can create bookings" ON public.bookings;
CREATE POLICY "Anyone can create bookings" ON public.bookings FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Public view bookings" ON public.bookings;
CREATE POLICY "Public view bookings" ON public.bookings FOR SELECT TO anon, authenticated USING (true);

-- 4. RE-VINCULAR ORDERS (PARA GARANTIR QUE FUNCIONE MESMO COM FK)
-- Se bookings foi apagada, o FK pode estar quebrado.
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='booking_id') THEN
        ALTER TABLE public.orders ADD COLUMN booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 5. TRIGGER PARA AUTO-GERAR CONFIRMAÇÃO NA BOOKINGS TAMBÉM (Legacy)
CREATE OR REPLACE FUNCTION public.generate_confirmation_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  IF NEW.confirmation_code IS NULL THEN
    LOOP
      new_code := UPPER(SUBSTRING(MD5(gen_random_uuid()::TEXT) FROM 1 FOR 6));
      SELECT EXISTS(SELECT 1 FROM public.bookings WHERE confirmation_code = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    NEW.confirmation_code := new_code;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_confirmation_code ON public.bookings;
CREATE TRIGGER set_confirmation_code
  BEFORE INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_confirmation_code();
