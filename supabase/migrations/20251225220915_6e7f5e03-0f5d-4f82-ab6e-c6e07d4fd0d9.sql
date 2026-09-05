-- Drop existing broken policies
DROP POLICY IF EXISTS "Restaurant owners can upload menu images" ON storage.objects;
DROP POLICY IF EXISTS "Restaurant owners can update menu images" ON storage.objects;
DROP POLICY IF EXISTS "Restaurant owners can delete menu images" ON storage.objects;

-- Create corrected policies using objects.name for the folder check
CREATE POLICY "Restaurant owners can upload menu images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'menu-images' AND 
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.restaurants 
    WHERE restaurants.owner_id = auth.uid() 
    AND restaurants.id::text = (storage.foldername(objects.name))[1]
  )
);

CREATE POLICY "Restaurant owners can update menu images" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'menu-images' AND 
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.restaurants 
    WHERE restaurants.owner_id = auth.uid() 
    AND restaurants.id::text = (storage.foldername(objects.name))[1]
  )
);

CREATE POLICY "Restaurant owners can delete menu images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'menu-images' AND 
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.restaurants 
    WHERE restaurants.owner_id = auth.uid() 
    AND restaurants.id::text = (storage.foldername(objects.name))[1]
  )
);