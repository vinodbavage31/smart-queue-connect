
-- Fix: restrict notification inserts - only the system (via edge functions) or the business owner should create notifications
-- Drop the overly permissive policy
DROP POLICY "System can insert notifications" ON public.notifications;

-- Allow owners to insert notifications for users in their business queue
CREATE POLICY "Owners can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.businesses biz ON b.business_id = biz.id
    WHERE b.user_id = notifications.user_id AND biz.owner_id = auth.uid()
  )
  OR auth.uid() = user_id
);
