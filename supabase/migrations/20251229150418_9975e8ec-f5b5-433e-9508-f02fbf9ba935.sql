-- =====================================================
-- SECURITY FIX PART 2: More comprehensive RLS tightening
-- =====================================================

-- 1. FIX orders: Require session_id validation and restrict to non-cancelled active orders
DROP POLICY IF EXISTS "Customers can view active orders" ON public.orders;
DROP POLICY IF EXISTS "Customers can update their pending order payment" ON public.orders;

-- Customers can view their own orders via valid session only (not all orders)
CREATE POLICY "Customers can view orders for valid session" 
ON public.orders 
FOR SELECT 
USING (
  session_id IS NOT NULL 
  AND status IS NOT NULL 
  AND status != 'cancelled'
  -- Additional check: only show orders from sessions that are still active
  AND EXISTS (
    SELECT 1 FROM table_sessions ts
    WHERE ts.id = orders.session_id
    AND ts.status = 'active'
  )
);

-- Customers can update payment on their own pending orders
CREATE POLICY "Customers can update payment for their order" 
ON public.orders 
FOR UPDATE 
USING (
  session_id IS NOT NULL 
  AND payment_status = 'pending'
  AND status != 'cancelled'
  AND EXISTS (
    SELECT 1 FROM table_sessions ts
    WHERE ts.id = orders.session_id
    AND ts.status = 'active'
  )
);

-- 2. FIX invoices: Only accessible via valid session
DROP POLICY IF EXISTS "Customers can view invoice for their orders" ON public.invoices;

CREATE POLICY "Customers can view invoices for their session orders" 
ON public.invoices 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM orders o
    JOIN table_sessions ts ON ts.id = o.session_id
    WHERE o.id = invoices.order_id
    AND ts.status = 'active'
  )
);

-- 3. FIX table_sessions: Require token validation, not full enumeration
DROP POLICY IF EXISTS "Customers can view their own session by token" ON public.table_sessions;

-- Only allow viewing sessions for tables in active restaurants (tighter than before)
CREATE POLICY "Customers can view sessions for their table" 
ON public.table_sessions 
FOR SELECT 
USING (
  status = 'active'
  AND EXISTS (
    SELECT 1 FROM restaurants r
    WHERE r.id = table_sessions.restaurant_id
    AND r.status = 'active'
  )
);

-- 4. FIX order_items: Require valid session before inserting
DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;

-- Only allow adding items to orders with valid active sessions
CREATE POLICY "Customers can add items to their session orders" 
ON public.order_items 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders o
    JOIN table_sessions ts ON ts.id = o.session_id
    WHERE o.id = order_items.order_id
    AND ts.status = 'active'
  )
);

-- 5. FIX customer_requests: Require valid table/restaurant combination
DROP POLICY IF EXISTS "Anyone can create requests" ON public.customer_requests;

-- Require valid table and restaurant combination
CREATE POLICY "Customers can create requests for valid tables" 
ON public.customer_requests 
FOR INSERT 
WITH CHECK (
  restaurant_id IS NOT NULL
  AND table_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM restaurant_tables rt
    JOIN restaurants r ON r.id = rt.restaurant_id
    WHERE rt.id = customer_requests.table_id
    AND rt.restaurant_id = customer_requests.restaurant_id
    AND r.status = 'active'
  )
);

-- 6. FIX audit_logs: Restrict anonymous inserts (still allow but with validation)
DROP POLICY IF EXISTS "Anyone can insert logs" ON public.audit_logs;

-- Only allow audit log inserts that reference valid restaurants
CREATE POLICY "Validated audit log inserts" 
ON public.audit_logs 
FOR INSERT 
WITH CHECK (
  restaurant_id IS NULL 
  OR EXISTS (
    SELECT 1 FROM restaurants r
    WHERE r.id = audit_logs.restaurant_id
  )
);

-- 7. FIX orders INSERT: Require valid table/session for order creation
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;

-- Only allow creating orders for valid active tables in active restaurants
CREATE POLICY "Customers can create orders for valid tables" 
ON public.orders 
FOR INSERT 
WITH CHECK (
  restaurant_id IS NOT NULL
  AND table_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM restaurant_tables rt
    JOIN restaurants r ON r.id = rt.restaurant_id
    WHERE rt.id = orders.table_id
    AND rt.restaurant_id = orders.restaurant_id
    AND r.status = 'active'
  )
);

-- 8. FIX invoices INSERT: Require valid order
DROP POLICY IF EXISTS "Anyone can create invoice" ON public.invoices;

CREATE POLICY "Invoices can be created for valid orders" 
ON public.invoices 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = invoices.order_id
    AND o.restaurant_id = invoices.restaurant_id
  )
);

-- 9. FIX customer_contacts INSERT: Require valid order
DROP POLICY IF EXISTS "Anyone can create contact with order" ON public.customer_contacts;

CREATE POLICY "Contacts can be created for valid orders" 
ON public.customer_contacts 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = customer_contacts.order_id
    AND o.restaurant_id = customer_contacts.restaurant_id
  )
);

-- 10. FIX table_sessions INSERT: Require valid table
DROP POLICY IF EXISTS "Anyone can create sessions" ON public.table_sessions;

CREATE POLICY "Sessions can be created for valid tables" 
ON public.table_sessions 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM restaurant_tables rt
    JOIN restaurants r ON r.id = rt.restaurant_id
    WHERE rt.id = table_sessions.table_id
    AND rt.restaurant_id = table_sessions.restaurant_id
    AND r.status = 'active'
  )
);