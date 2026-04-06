-- Add receipt_url to internal_credits (used by AdminCreditsTab receipt upload)
ALTER TABLE public.internal_credits
  ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- Ensure product_name alias is not needed: BookingDetail uses product_id which is available
-- Update the update-booking-status function validstatuses to include 'paid' and 'waiting_local'
-- (This is a code fix, no migration needed for this one)

-- Re-enable proper access for internal_credits
GRANT ALL ON TABLE public.internal_credits TO anon, authenticated;

-- Ensure site_settings table exists with proper access
CREATE TABLE IF NOT EXISTS public.site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin Full Access" ON public.site_settings;
CREATE POLICY "Admin Full Access" ON public.site_settings
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public.site_settings TO anon, authenticated;

-- Ensure internal_credits RLS is consistent
DROP POLICY IF EXISTS "Admin access" ON public.internal_credits;
DROP POLICY IF EXISTS "Admin Full Access" ON public.internal_credits;
CREATE POLICY "Admin Full Access" ON public.internal_credits
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
