
-- Add confirmation_code, phone, and notes columns
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS confirmation_code TEXT UNIQUE;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP WITH TIME ZONE;

-- Function to generate a unique 6-char alphanumeric code
CREATE OR REPLACE FUNCTION public.generate_confirmation_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    new_code := UPPER(SUBSTRING(MD5(gen_random_uuid()::TEXT) FROM 1 FOR 6));
    SELECT EXISTS(SELECT 1 FROM public.bookings WHERE confirmation_code = new_code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  NEW.confirmation_code := new_code;
  RETURN NEW;
END;
$$;

-- Trigger to auto-generate code on insert
CREATE TRIGGER set_confirmation_code
  BEFORE INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_confirmation_code();

-- Enable realtime for bookings
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
