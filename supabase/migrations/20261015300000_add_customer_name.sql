-- Add customer_name column to kiosk_reservations and quad_reservations
-- This allows manual edits in the admin panel to persist correctly.

ALTER TABLE public.kiosk_reservations 
ADD COLUMN IF NOT EXISTS customer_name TEXT;

ALTER TABLE public.quad_reservations 
ADD COLUMN IF NOT EXISTS customer_name TEXT;

-- Grant permissions to access these new columns
GRANT ALL ON TABLE public.kiosk_reservations TO anon, authenticated;
GRANT ALL ON TABLE public.quad_reservations TO anon, authenticated;
