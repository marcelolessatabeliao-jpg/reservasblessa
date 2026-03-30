@echo off
"C:\Program Files\PostgreSQL\16\bin\psql.exe" postgresql://postgres:postgres@localhost:54322/postgres -f "supabase/migrations/20261015300000_add_customer_name.sql"
