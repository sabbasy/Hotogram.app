-- Add cancelled_items JSON column to orders to track cancellation history
-- This stores records of cancelled items for display on both customer and kitchen sides
ALTER TABLE public.orders ADD COLUMN cancelled_items jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.orders.cancelled_items IS 'Array of {item_name, item_price, quantity, cancelled_at, cancelled_by} objects tracking cancelled items for history display';