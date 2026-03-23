
-- Add basic validation to INSERT policies to prevent abuse
DROP POLICY "Anyone can create bookings" ON public.bookings;
CREATE POLICY "Anyone can create bookings with validation"
  ON public.bookings
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    name IS NOT NULL AND
    length(name) > 0 AND
    length(name) <= 200 AND
    visit_date >= CURRENT_DATE AND
    adults >= 0 AND
    total_amount >= 0
  );

DROP POLICY "Anyone can create quad reservations" ON public.quad_reservations;
CREATE POLICY "Anyone can create quad reservations with validation"
  ON public.quad_reservations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    reservation_date >= CURRENT_DATE AND
    quantity > 0 AND
    quantity <= 10
  );
