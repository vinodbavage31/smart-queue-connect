
-- Add business_status enum
CREATE TYPE public.business_status AS ENUM ('pending', 'approved', 'rejected');

-- Add status column to businesses
ALTER TABLE public.businesses ADD COLUMN status business_status NOT NULL DEFAULT 'pending';

-- Update existing businesses to approved
UPDATE public.businesses SET status = 'approved' WHERE status = 'pending';

-- Drop old RLS policy for viewing businesses
DROP POLICY IF EXISTS "Anyone can view businesses" ON public.businesses;

-- Allow anyone (including anonymous) to view approved businesses
CREATE POLICY "Anyone can view approved businesses"
ON public.businesses FOR SELECT
USING (status = 'approved');

-- Owners can always see their own businesses regardless of status
CREATE POLICY "Owners can view own businesses"
ON public.businesses FOR SELECT
TO authenticated
USING (auth.uid() = owner_id);

-- Admins can view all businesses
CREATE POLICY "Admins can view all businesses"
ON public.businesses FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update any business (for approval/rejection)
CREATE POLICY "Admins can update any business"
ON public.businesses FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow anonymous access to services for approved businesses
DROP POLICY IF EXISTS "Anyone can view services" ON public.services;
CREATE POLICY "Anyone can view services"
ON public.services FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.businesses
  WHERE businesses.id = services.business_id
  AND businesses.status = 'approved'
));

-- Allow anonymous access to bookings count (for queue display)
-- We need a policy for anon to count bookings on approved businesses
CREATE POLICY "Anyone can count bookings for approved businesses"
ON public.bookings FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.businesses
  WHERE businesses.id = bookings.business_id
  AND businesses.status = 'approved'
));

-- Enable anonymous access by granting usage to anon role
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON public.businesses TO anon;
GRANT SELECT ON public.services TO anon;
GRANT SELECT ON public.bookings TO anon;
