-- Fix RLS policies that depend on direct restaurants table access
-- These policies need to work for anonymous users scanning QR codes

-- Create a helper function to check if a restaurant is active (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_restaurant_active(_restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restaurants 
    WHERE id = _restaurant_id AND status = 'active'
  );
$$;

-- Drop and recreate the restaurant_tables public SELECT policy to use the new function
DROP POLICY IF EXISTS "Public can view tables of active restaurants" ON public.restaurant_tables;

CREATE POLICY "Public can view tables of active restaurants"
ON public.restaurant_tables
FOR SELECT
USING (is_restaurant_active(restaurant_id));

-- Drop and recreate the table_sessions public SELECT policy to use the new function
DROP POLICY IF EXISTS "Customers can view sessions for their table" ON public.table_sessions;

CREATE POLICY "Customers can view sessions for their table"
ON public.table_sessions
FOR SELECT
USING (status = 'active' AND is_restaurant_active(restaurant_id));

-- Drop and recreate the table_sessions INSERT policy to use the new function
DROP POLICY IF EXISTS "Sessions can be created for valid tables" ON public.table_sessions;

CREATE POLICY "Sessions can be created for valid tables"
ON public.table_sessions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurant_tables rt
    WHERE rt.id = table_sessions.table_id 
    AND rt.restaurant_id = table_sessions.restaurant_id
  )
  AND is_restaurant_active(restaurant_id)
);

-- Fix orders INSERT policy
DROP POLICY IF EXISTS "Customers can create orders for valid tables" ON public.orders;

CREATE POLICY "Customers can create orders for valid tables"
ON public.orders
FOR INSERT
WITH CHECK (
  restaurant_id IS NOT NULL 
  AND table_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.restaurant_tables rt
    WHERE rt.id = orders.table_id 
    AND rt.restaurant_id = orders.restaurant_id
  )
  AND is_restaurant_active(restaurant_id)
);

-- Fix customer_requests INSERT policy
DROP POLICY IF EXISTS "Customers can create requests for valid tables" ON public.customer_requests;

CREATE POLICY "Customers can create requests for valid tables"
ON public.customer_requests
FOR INSERT
WITH CHECK (
  restaurant_id IS NOT NULL 
  AND table_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.restaurant_tables rt
    WHERE rt.id = customer_requests.table_id 
    AND rt.restaurant_id = customer_requests.restaurant_id
  )
  AND is_restaurant_active(restaurant_id)
);