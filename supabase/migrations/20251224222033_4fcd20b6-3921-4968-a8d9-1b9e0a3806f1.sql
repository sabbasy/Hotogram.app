-- Add order lifecycle timestamp columns (if not already present)
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS placed_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS accepted_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS preparing_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS ready_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS served_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS closed_at timestamp with time zone;

-- Update existing orders to have placed_at equal to created_at
UPDATE public.orders SET placed_at = created_at WHERE placed_at IS NULL;