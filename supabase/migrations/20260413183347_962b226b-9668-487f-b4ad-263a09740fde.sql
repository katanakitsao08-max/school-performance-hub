
-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  school_id UUID REFERENCES public.schools(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users view own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can mark their own notifications as read
CREATE POLICY "Users update own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users delete own notifications"
ON public.notifications FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Admins can manage school notifications
CREATE POLICY "Admin manage school notifications"
ON public.notifications FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND school_id = get_user_school_id(auth.uid())
);

-- Super admin full access
CREATE POLICY "SA full notifications"
ON public.notifications FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Service role can insert notifications (for triggers/functions)
CREATE POLICY "Service insert notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create index for fast lookups
CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON public.notifications(created_at DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Helper function to create notifications
CREATE OR REPLACE FUNCTION public.create_notification(
  _user_id UUID,
  _school_id UUID,
  _title TEXT,
  _message TEXT,
  _type TEXT DEFAULT 'info',
  _metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, school_id, title, message, type, metadata)
  VALUES (_user_id, _school_id, _title, _message, _type, _metadata)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;
