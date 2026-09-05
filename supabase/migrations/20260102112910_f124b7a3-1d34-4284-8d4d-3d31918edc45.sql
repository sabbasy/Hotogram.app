-- Drop and recreate the get_public_restaurant_info function to include upi_id for UPI payments
DROP FUNCTION IF EXISTS public.get_public_restaurant_info(uuid);

CREATE FUNCTION public.get_public_restaurant_info(_restaurant_id uuid)
RETURNS TABLE(
  id uuid, 
  name text, 
  cuisine_type text, 
  address text, 
  logo_url text, 
  currency text, 
  tax_percentage numeric, 
  status restaurant_status, 
  feature_voice_notes boolean,
  upi_id text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    r.id,
    r.name,
    r.cuisine_type,
    r.address,
    r.logo_url,
    r.currency,
    r.tax_percentage,
    r.status,
    r.feature_voice_notes,
    r.upi_id
  FROM public.restaurants r
  WHERE r.id = _restaurant_id
  AND r.status = 'active'
$$;