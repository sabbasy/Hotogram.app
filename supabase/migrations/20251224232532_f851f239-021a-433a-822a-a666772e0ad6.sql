-- Drop the existing policies that are too restrictive
DROP POLICY IF EXISTS "Anyone can view orders by table token" ON public.orders;
DROP POLICY IF EXISTS "Anyone can update order payment" ON public.orders;

-- Create a better policy that allows viewing orders by table_id or session_id
CREATE POLICY "Customers can view orders by table or session" 
ON public.orders 
FOR SELECT 
USING (
  table_id IS NOT NULL 
  OR session_id IS NOT NULL
);

-- Allow customers to update payment status on their orders
CREATE POLICY "Customers can update order payment" 
ON public.orders 
FOR UPDATE 
USING (
  table_id IS NOT NULL 
  OR session_id IS NOT NULL
)
WITH CHECK (
  table_id IS NOT NULL 
  OR session_id IS NOT NULL
);