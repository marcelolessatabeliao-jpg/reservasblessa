
-- Create bookings table (public, no auth required)
CREATE TABLE public.bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  visit_date DATE NOT NULL,
  adults INTEGER NOT NULL DEFAULT 0,
  children JSONB DEFAULT '[]'::jsonb,
  has_donation BOOLEAN DEFAULT false,
  is_associado BOOLEAN DEFAULT false,
  kiosks JSONB DEFAULT '[]'::jsonb,
  quads JSONB DEFAULT '[]'::jsonb,
  additionals JSONB DEFAULT '[]'::jsonb,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert bookings (no auth required for public booking)
CREATE POLICY "Anyone can create bookings"
  ON public.bookings
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow reading bookings (for availability checks)
CREATE POLICY "Anyone can read bookings"
  ON public.bookings
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Create quad_reservations table for time slot tracking
CREATE TABLE public.quad_reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  quad_type TEXT NOT NULL,
  reservation_date DATE NOT NULL,
  time_slot TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.quad_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create quad reservations"
  ON public.quad_reservations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can read quad reservations"
  ON public.quad_reservations
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
