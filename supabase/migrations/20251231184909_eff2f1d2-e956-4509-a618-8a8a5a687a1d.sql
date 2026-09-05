-- Drop the existing overly permissive public SELECT policy
DROP POLICY IF EXISTS "Public can view active restaurants" ON public.restaurants;

-- Create a security definer function that returns only non-sensitive restaurant data
CREATE OR REPLACE FUNCTION public.get_public_restaurant_info(_restaurant_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  cuisine_type text,
  address text,
  logo_url text,
  currency text,
  tax_percentage numeric,
  status restaurant_status,
  feature_voice_notes boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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
    r.feature_voice_notes
  FROM public.restaurants r
  WHERE r.id = _restaurant_id
  AND r.status = 'active'
$$;

-- Create a new restrictive public SELECT policy that only allows access via the function
-- This policy denies direct table access for anonymous users
CREATE POLICY "Public can only view via function"
ON public.restaurants
FOR SELECT
USING (
  -- Allow authenticated users with restaurant access
  has_restaurant_access(auth.uid(), id)
  OR
  -- Allow platform admins
  has_role(auth.uid(), 'platform_admin')
  OR
  -- Allow restaurant owners
  owner_id = auth.uid()
);