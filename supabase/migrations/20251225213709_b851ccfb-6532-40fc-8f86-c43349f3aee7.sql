-- Add customer_name and customer_phone columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS customer_name text,
ADD COLUMN IF NOT EXISTS customer_phone text;