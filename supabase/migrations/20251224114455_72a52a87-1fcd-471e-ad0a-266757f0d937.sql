-- Phase 3: Staff roles, customer requests, voice notes, subscriptions, analytics

-- 1. Add new staff roles to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'waiter';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cashier';

-- 2. Create subscription plan enum
CREATE TYPE public.subscription_plan AS ENUM ('free', 'basic', 'pro');

-- 3. Create customer request type enum
CREATE TYPE public.request_type AS ENUM ('call_waiter', 'request_water', 'request_bill');

-- 4. Create customer request status enum
CREATE TYPE public.request_status AS ENUM ('pending', 'handled');

-- 5. Add subscription plan and features to restaurants
ALTER TABLE public.restaurants 
ADD COLUMN subscription_plan subscription_plan NOT NULL DEFAULT 'free',
ADD COLUMN feature_voice_notes BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN feature_analytics BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN feature_customer_export BOOLEAN NOT NULL DEFAULT false;

-- 6. Add order notes and voice note URL to orders
ALTER TABLE public.orders 
ADD COLUMN special_instructions TEXT,
ADD COLUMN voice_note_url TEXT,
ADD COLUMN voice_note_listened BOOLEAN NOT NULL DEFAULT false;

-- 7. Create customer_requests table for waiter calls, water requests, etc.
CREATE TABLE public.customer_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    table_id UUID REFERENCES public.restaurant_tables(id) ON DELETE SET NULL,
    table_number TEXT NOT NULL,
    request_type request_type NOT NULL,
    status request_status NOT NULL DEFAULT 'pending',
    handled_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    handled_at TIMESTAMP WITH TIME ZONE
);

-- 8. Create customer_tags table for marketing readiness
CREATE TABLE public.customer_tags (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES public.customer_contacts(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(contact_id, tag)
);

-- 9. Create audit_logs table for system hardening
CREATE TABLE public.audit_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    restaurant_id UUID,
    user_id UUID,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 10. Add visit and spend tracking to customer_contacts
ALTER TABLE public.customer_contacts
ADD COLUMN visit_count INTEGER NOT NULL DEFAULT 1,
ADD COLUMN total_spend NUMERIC NOT NULL DEFAULT 0;

-- 11. Enable RLS on new tables
ALTER TABLE public.customer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 12. RLS policies for customer_requests
CREATE POLICY "Anyone can create requests" ON public.customer_requests
FOR INSERT WITH CHECK (true);

CREATE POLICY "Restaurant staff can view requests" ON public.customer_requests
FOR SELECT USING (has_restaurant_access(auth.uid(), restaurant_id));

CREATE POLICY "Restaurant staff can update requests" ON public.customer_requests
FOR UPDATE USING (has_restaurant_access(auth.uid(), restaurant_id));

-- 13. RLS policies for customer_tags
CREATE POLICY "Restaurant staff can manage tags" ON public.customer_tags
FOR ALL USING (has_restaurant_access(auth.uid(), restaurant_id));

-- 14. RLS policies for audit_logs
CREATE POLICY "Restaurant staff can view their logs" ON public.audit_logs
FOR SELECT USING (has_restaurant_access(auth.uid(), restaurant_id));

CREATE POLICY "Platform admins can view all logs" ON public.audit_logs
FOR SELECT USING (has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "Anyone can insert logs" ON public.audit_logs
FOR INSERT WITH CHECK (true);

-- 15. Enable realtime for customer_requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_requests;

-- 16. Create storage bucket for voice notes
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('voice-notes', 'voice-notes', true, 5242880)
ON CONFLICT (id) DO NOTHING;

-- 17. Storage policies for voice notes
CREATE POLICY "Anyone can upload voice notes" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'voice-notes');

CREATE POLICY "Anyone can view voice notes" ON storage.objects
FOR SELECT USING (bucket_id = 'voice-notes');

CREATE POLICY "Restaurant staff can delete voice notes" ON storage.objects
FOR DELETE USING (bucket_id = 'voice-notes');