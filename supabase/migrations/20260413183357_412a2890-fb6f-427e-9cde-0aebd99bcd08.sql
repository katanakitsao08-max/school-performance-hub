
-- Drop the overly permissive insert policy
DROP POLICY "Service insert notifications" ON public.notifications;

-- Replace with a proper insert policy
-- The create_notification function (SECURITY DEFINER) handles programmatic inserts
-- Users should not directly insert notifications - only the system does
CREATE POLICY "Users self-insert notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
