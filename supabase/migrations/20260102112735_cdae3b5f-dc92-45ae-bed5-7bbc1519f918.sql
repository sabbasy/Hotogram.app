-- Add UPI ID field to restaurants for UPI payment processing
ALTER TABLE public.restaurants
ADD COLUMN upi_id text DEFAULT NULL;

-- Add comment explaining the field
COMMENT ON COLUMN public.restaurants.upi_id IS 'UPI ID (VPA) for receiving payments e.g. restaurant@upi';