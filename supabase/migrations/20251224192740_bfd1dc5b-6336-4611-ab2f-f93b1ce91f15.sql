-- Create table_sessions table for managing table ordering sessions
CREATE TABLE public.table_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add session_id to orders table for session grouping
ALTER TABLE public.orders ADD COLUMN session_id UUID REFERENCES public.table_sessions(id);

-- Enable RLS
ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;

-- Anyone can view sessions (for QR access)
CREATE POLICY "Anyone can view active sessions" 
ON public.table_sessions 
FOR SELECT 
USING (true);

-- Anyone can create sessions (customer starting a table)
CREATE POLICY "Anyone can create sessions" 
ON public.table_sessions 
FOR INSERT 
WITH CHECK (true);

-- Restaurant staff can update sessions
CREATE POLICY "Restaurant staff can update sessions" 
ON public.table_sessions 
FOR UPDATE 
USING (public.has_restaurant_access(auth.uid(), restaurant_id));

-- Enable realtime for table_sessions
ALTER PUBLICATION supabase_realtime ADD TABLE public.table_sessions;

-- Create index for faster lookups
CREATE INDEX idx_table_sessions_table_active ON public.table_sessions(table_id, status) WHERE status = 'active';
CREATE INDEX idx_orders_session ON public.orders(session_id);