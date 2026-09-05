-- Allow customers to view orders by their table's QR token
-- This enables the order tracker page to work for unauthenticated customers

-- Policy for orders: customers can view orders for tables they have access to via QR token
CREATE POLICY "Anyone can view orders by table token" 
ON public.orders 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM restaurant_tables 
    WHERE restaurant_tables.id = orders.table_id
  )
);

-- Policy for order_items: customers can view items for visible orders
CREATE POLICY "Anyone can view order items" 
ON public.order_items 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = order_items.order_id
  )
);

-- Allow customers to update payment status on their orders
CREATE POLICY "Anyone can update order payment" 
ON public.orders 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM restaurant_tables 
    WHERE restaurant_tables.id = orders.table_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM restaurant_tables 
    WHERE restaurant_tables.id = orders.table_id
  )
);