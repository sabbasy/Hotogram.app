-- Phase 2: Add table status, payment tracking, customer contacts, and invoices

-- 1. Add table_status enum for table lifecycle
CREATE TYPE public.table_status AS ENUM ('vacant', 'occupied', 'billing', 'closed');

-- 2. Add payment_status enum
CREATE TYPE public.payment_status AS ENUM ('pending', 'paid');

-- 3. Add payment_method enum
CREATE TYPE public.payment_method AS ENUM ('upi', 'counter', 'none');

-- 4. Add status column to restaurant_tables
ALTER TABLE public.restaurant_tables 
ADD COLUMN status table_status NOT NULL DEFAULT 'vacant';

-- 5. Add tax_percentage to restaurants
ALTER TABLE public.restaurants 
ADD COLUMN tax_percentage numeric NOT NULL DEFAULT 5;

-- 6. Add payment fields to orders
ALTER TABLE public.orders 
ADD COLUMN payment_status payment_status NOT NULL DEFAULT 'pending',
ADD COLUMN payment_method payment_method NOT NULL DEFAULT 'none',
ADD COLUMN tax_amount numeric NOT NULL DEFAULT 0,
ADD COLUMN subtotal numeric NOT NULL DEFAULT 0;

-- 7. Create customer_contacts table for consent management
CREATE TABLE public.customer_contacts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    phone TEXT,
    email TEXT,
    consent_given BOOLEAN NOT NULL DEFAULT false,
    consent_timestamp TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 8. Create invoices table
CREATE TABLE public.invoices (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL,
    subtotal NUMERIC NOT NULL,
    tax_amount NUMERIC NOT NULL,
    total_amount NUMERIC NOT NULL,
    sent_via TEXT,
    sent_to TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 9. Enable RLS on new tables
ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- 10. RLS policies for customer_contacts
CREATE POLICY "Anyone can create contact with order" ON public.customer_contacts
FOR INSERT WITH CHECK (true);

CREATE POLICY "Restaurant staff can view their contacts" ON public.customer_contacts
FOR SELECT USING (has_restaurant_access(auth.uid(), restaurant_id));

-- 11. RLS policies for invoices
CREATE POLICY "Anyone can create invoice" ON public.invoices
FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view invoice by order" ON public.invoices
FOR SELECT USING (true);

CREATE POLICY "Restaurant staff can manage invoices" ON public.invoices
FOR ALL USING (has_restaurant_access(auth.uid(), restaurant_id));

-- 12. Add realtime for restaurant_tables (for table status updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurant_tables;
ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;