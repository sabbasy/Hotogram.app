-- Fix menu_categories and menu_items SELECT policies to use the security definer function
-- These policies currently check restaurants table directly which anonymous users cannot access

-- Drop and recreate the menu_categories public SELECT policy
DROP POLICY IF EXISTS "Anyone can view categories of active restaurants" ON public.menu_categories;

CREATE POLICY "Anyone can view categories of active restaurants"
ON public.menu_categories
FOR SELECT
USING (is_restaurant_active(restaurant_id));

-- Drop and recreate the menu_items public SELECT policy
DROP POLICY IF EXISTS "Anyone can view items of active restaurants" ON public.menu_items;

CREATE POLICY "Anyone can view items of active restaurants"
ON public.menu_items
FOR SELECT
USING (is_restaurant_active(restaurant_id));