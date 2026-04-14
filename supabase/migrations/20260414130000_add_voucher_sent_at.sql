-- Add last_voucher_sent_at column to orders to track voucher delivery
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS last_voucher_sent_at TIMESTAMP WITH TIME ZONE;
