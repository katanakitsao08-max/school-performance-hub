
-- Use platform-wide Olympus account for all schools by default.
-- Deactivate stale per-school SMS overrides so the global fallback is used.
UPDATE public.school_sms_config SET is_active = false;

-- Upsert the global config singleton with the working Olympus token
INSERT INTO public.global_sms_config (singleton, provider, endpoint, api_key, sender_id, is_active, headers_json, body_template)
VALUES (true, 'olympus_teleserve', 'https://sms.ots.co.ke/api/v3/sms/send',
        '3049|QewrHg1ADAqiadVtVWcZ8g0HsuI9ce0vsnxN7qJn8914a1cf',
        'PROCALL', true, '{}'::jsonb, '{"type":"plain"}'::jsonb)
ON CONFLICT (singleton) DO UPDATE
SET provider = EXCLUDED.provider,
    endpoint = EXCLUDED.endpoint,
    api_key = EXCLUDED.api_key,
    sender_id = EXCLUDED.sender_id,
    is_active = true,
    body_template = EXCLUDED.body_template,
    updated_at = now();
