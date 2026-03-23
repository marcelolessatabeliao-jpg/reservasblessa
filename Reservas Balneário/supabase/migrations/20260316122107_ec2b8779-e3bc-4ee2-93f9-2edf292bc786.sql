-- Allow service role to update booking status
CREATE POLICY "Service role can update bookings"
ON public.bookings
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- Also allow anon/authenticated to update via edge function (service role)
-- We'll use service role in edge functions, so this policy covers it