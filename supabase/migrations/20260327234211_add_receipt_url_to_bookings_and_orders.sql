alter table if exists bookings add column if not exists receipt_url text;
alter table if exists orders add column if not exists receipt_url text;
alter table if exists kiosk_reservations add column if not exists receipt_url text;
alter table if exists quad_reservations add column if not exists receipt_url text;
