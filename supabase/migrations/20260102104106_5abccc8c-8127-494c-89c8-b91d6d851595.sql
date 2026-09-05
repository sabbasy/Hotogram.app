-- Fix PUBLIC_DATA_EXPOSURE: Remove the public SELECT policy that exposes owner email/phone
-- The get_public_restaurant_info RPC function already provides safe public access

-- Drop the overly permissive public policy if it exists
DROP POLICY IF EXISTS "Public can view active restaurants" ON public.restaurants;

-- The remaining SELECT policies are sufficient:
-- 1. "Public can only view via function" - allows authenticated users with restaurant access or platform admins
-- 2. "Restaurant owners can view their own restaurants" - allows owners
-- 3. "Platform admins can view all restaurants" - allows platform admins

-- Verify that public access is only available through the RPC function get_public_restaurant_info
-- which only returns: id, name, cuisine_type, address, logo_url, currency, tax_percentage, status, feature_voice_notes
-- and explicitly excludes: email, phone, owner_id