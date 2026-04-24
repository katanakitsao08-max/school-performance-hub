ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS whatsapp_number text;

COMMENT ON COLUMN public.profiles.whatsapp_number IS 'Personal WhatsApp number used for click-to-send wa.me links. Format: +2547XXXXXXXX';