
-- Unique constraint: one active booking per user per business
CREATE UNIQUE INDEX idx_one_active_booking_per_user_business 
ON public.bookings (user_id, business_id) 
WHERE status IN ('waiting', 'calling', 'in_progress');

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_bookings_business_status ON public.bookings (business_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_user_status ON public.bookings (user_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_business_created ON public.bookings (business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_businesses_status_open ON public.businesses (status, is_open);

-- Add max_queue_size and is_queue_paused to businesses
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS max_queue_size integer DEFAULT 50;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS is_queue_paused boolean DEFAULT false;

-- Enable realtime for bookings
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
