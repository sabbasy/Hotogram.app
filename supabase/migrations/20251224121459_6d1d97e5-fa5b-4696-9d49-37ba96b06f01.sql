-- Make voice-notes bucket private
UPDATE storage.buckets SET public = false WHERE id = 'voice-notes';

-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Anyone can view voice notes" ON storage.objects;

-- Create a new SELECT policy that requires authentication and restaurant access
CREATE POLICY "Restaurant staff can view voice notes" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'voice-notes' AND 
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.voice_note_url LIKE '%' || storage.objects.name
    AND public.has_restaurant_access(auth.uid(), o.restaurant_id)
  )
);