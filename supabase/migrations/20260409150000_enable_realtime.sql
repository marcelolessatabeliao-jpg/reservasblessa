-- ==========================================================
-- ENABLE SUPABASE REALTIME FOR RESERVATIONS AND ORDERS
-- ==========================================================

-- 1. Ensure the publication exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- 2. Add tables to the publication
-- Note: 'alter publication' will fail if the table is already in it, so we catch errors
DO $$ 
DECLARE 
    tbl text;
    tables_to_enable text[] := ARRAY['orders', 'order_items', 'bookings', 'kiosk_reservations', 'quad_reservations', 'internal_credits', 'payments'];
BEGIN
    FOREACH tbl IN ARRAY tables_to_enable LOOP
        BEGIN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
        EXCEPTION 
            WHEN duplicate_object THEN NULL;
            WHEN others THEN NULL; -- Ignore other errors like table not found
        END;
    END LOOP;
END $$;

-- 3. Ensure REPLICA IDENTITY is set to FULL for accurate tracking if needed
-- (Optional, but helps if you need old data in the payload)
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.bookings REPLICA IDENTITY FULL;
ALTER TABLE public.kiosk_reservations REPLICA IDENTITY FULL;
ALTER TABLE public.quad_reservations REPLICA IDENTITY FULL;
