-- Add 'cancelled' status to order_status enum
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'cancelled';