-- Add DELETE policies for tables that are missing them
-- This enables restaurant staff to delete records for data cleanup and GDPR compliance

-- DELETE policy for orders - allows restaurant staff to delete orders
CREATE POLICY "Restaurant staff can delete orders" 
ON public.orders 
FOR DELETE 
USING (has_restaurant_access(auth.uid(), restaurant_id));

-- DELETE policy for order_items - allows deletion via restaurant access check on parent order
CREATE POLICY "Restaurant staff can delete order items" 
ON public.order_items 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE id = order_id 
    AND has_restaurant_access(auth.uid(), restaurant_id)
  )
);

-- DELETE policy for customer_contacts - enables GDPR compliance
CREATE POLICY "Restaurant staff can delete customer contacts" 
ON public.customer_contacts 
FOR DELETE 
USING (has_restaurant_access(auth.uid(), restaurant_id));

-- DELETE policy for customer_requests - allows cleanup of old requests
CREATE POLICY "Restaurant staff can delete customer requests" 
ON public.customer_requests 
FOR DELETE 
USING (has_restaurant_access(auth.uid(), restaurant_id));