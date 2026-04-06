
-- Create site_settings table for global configuration
CREATE TABLE IF NOT EXISTS public.site_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Initial settings
INSERT INTO public.site_settings (key, value)
VALUES ('total_quads', '3')
ON CONFLICT (key) DO NOTHING;

-- Enable RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Policies: Anyone can read settings
DROP POLICY IF EXISTS "Anyone can read site settings" ON public.site_settings;
CREATE POLICY "Anyone can read site settings" ON public.site_settings FOR SELECT TO anon, authenticated USING (true);

-- Policies: Only authenticated can update (assuming admin uses auth, or anyone if we follow the current open pattern)
DROP POLICY IF EXISTS "Anyone can update site settings" ON public.site_settings;
CREATE POLICY "Anyone can update site settings" ON public.site_settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_settings TO anon, authenticated;
