-- Drop existing menu-images policies
DROP POLICY IF EXISTS "Restaurant owners can upload menu images" ON storage.objects;
DROP POLICY IF EXISTS "Restaurant owners can update menu images" ON storage.objects;
DROP POLICY IF EXISTS "Restaurant owners can delete menu images" ON storage.objects;

-- Create fixed policies that properly check restaurant ownership
CREATE POLICY "Restaurant owners can upload menu images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'menu-images' AND 
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM restaurants 
    WHERE restaurants.owner_id = auth.uid() 
    AND restaurants.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Restaurant owners can update menu images" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'menu-images' AND 
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM restaurants 
    WHERE restaurants.owner_id = auth.uid() 
    AND restaurants.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Restaurant owners can delete menu images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'menu-images' AND 
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM restaurants 
    WHERE restaurants.owner_id = auth.uid() 
    AND restaurants.id::text = (storage.foldername(name))[1]
  )
);