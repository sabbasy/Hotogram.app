-- Create payment_transactions table for tracking UPI payments
CREATE TABLE public.payment_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  order_id UUID,
  session_id UUID,
  transaction_id TEXT NOT NULL UNIQUE,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'upi',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verifying', 'paid', 'failed', 'expired')),
  upi_reference TEXT,
  customer_vpa TEXT,
  initiated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  verified_at TIMESTAMP WITH TIME ZONE,
  confirmed_by TEXT, -- 'customer' or 'restaurant'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Customers can create transactions for valid sessions
CREATE POLICY "Transactions can be created for valid orders" 
ON public.payment_transactions 
FOR INSERT 
WITH CHECK (
  (order_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM orders o 
    JOIN table_sessions ts ON ts.id = o.session_id
    WHERE o.id = payment_transactions.order_id 
    AND ts.status = 'active'
  ))
  OR
  (session_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM table_sessions ts
    WHERE ts.id = payment_transactions.session_id
    AND ts.status = 'active'
  ))
);

-- Customers can view their transaction status
CREATE POLICY "Customers can view transactions for active sessions" 
ON public.payment_transactions 
FOR SELECT 
USING (
  (order_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM orders o 
    JOIN table_sessions ts ON ts.id = o.session_id
    WHERE o.id = payment_transactions.order_id 
    AND ts.status = 'active'
  ))
  OR
  (session_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM table_sessions ts
    WHERE ts.id = payment_transactions.session_id
    AND ts.status = 'active'
  ))
);

-- Customers can update pending transactions (for confirmation)
CREATE POLICY "Customers can update pending transactions" 
ON public.payment_transactions 
FOR UPDATE 
USING (
  status IN ('pending', 'verifying') AND
  (
    (order_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM orders o 
      JOIN table_sessions ts ON ts.id = o.session_id
      WHERE o.id = payment_transactions.order_id 
      AND ts.status = 'active'
    ))
    OR
    (session_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM table_sessions ts
      WHERE ts.id = payment_transactions.session_id
      AND ts.status = 'active'
    ))
  )
);

-- Restaurant staff can view and manage transactions
CREATE POLICY "Restaurant staff can view transactions" 
ON public.payment_transactions 
FOR SELECT 
USING (has_restaurant_access(auth.uid(), restaurant_id));

CREATE POLICY "Restaurant staff can update transactions" 
ON public.payment_transactions 
FOR UPDATE 
USING (has_restaurant_access(auth.uid(), restaurant_id));

CREATE POLICY "Restaurant staff can delete transactions" 
ON public.payment_transactions 
FOR DELETE 
USING (has_restaurant_access(auth.uid(), restaurant_id));

-- Create index for faster lookups
CREATE INDEX idx_payment_transactions_order ON public.payment_transactions(order_id);
CREATE INDEX idx_payment_transactions_session ON public.payment_transactions(session_id);
CREATE INDEX idx_payment_transactions_status ON public.payment_transactions(status);
CREATE INDEX idx_payment_transactions_txn ON public.payment_transactions(transaction_id);

-- Add trigger for updated_at
CREATE TRIGGER update_payment_transactions_updated_at
BEFORE UPDATE ON public.payment_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for payment transactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_transactions;