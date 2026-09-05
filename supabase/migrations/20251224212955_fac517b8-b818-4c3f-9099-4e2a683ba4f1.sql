-- Phase 5: Add image support for menu items and restaurant logos

-- 1. Add image_url column to menu_items
ALTER TABLE public.menu_items 
ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;

-- 2. Add logo_url column to restaurants
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT NULL;

-- 3. Create storage bucket for menu images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'menu-images', 
  'menu-images', 
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 4. Create storage bucket for restaurant logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'restaurant-logos', 
  'restaurant-logos', 
  true,
  2097152, -- 2MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage policies for menu-images bucket
CREATE POLICY "Anyone can view menu images"
ON storage.objects FOR SELECT
USING (bucket_id = 'menu-images');

CREATE POLICY "Restaurant owners can upload menu images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'menu-images' AND
  EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE restaurants.owner_id = auth.uid()
    AND restaurants.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Restaurant owners can update menu images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'menu-images' AND
  EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE restaurants.owner_id = auth.uid()
    AND restaurants.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Restaurant owners can delete menu images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'menu-images' AND
  EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE restaurants.owner_id = auth.uid()
    AND restaurants.id::text = (storage.foldername(name))[1]
  )
);

-- 6. Storage policies for restaurant-logos bucket
CREATE POLICY "Anyone can view restaurant logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'restaurant-logos');

CREATE POLICY "Restaurant owners can upload logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'restaurant-logos' AND
  EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE restaurants.owner_id = auth.uid()
    AND restaurants.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Restaurant owners can update logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'restaurant-logos' AND
  EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE restaurants.owner_id = auth.uid()
    AND restaurants.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Restaurant owners can delete logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'restaurant-logos' AND
  EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE restaurants.owner_id = auth.uid()
    AND restaurants.id::text = (storage.foldername(name))[1]
  )
);