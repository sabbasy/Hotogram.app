-- Allow anyone to view active restaurants (for public menu access)
CREATE POLICY "Anyone can view active restaurants for menu" 
ON public.restaurants 
FOR SELECT 
USING (status = 'active');