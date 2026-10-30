-- Monitoring telemetry must never become a second copy of personal data.
--
-- The tables already store only identifiers, event types, and sanitized error
-- fields. These constraints keep it that way at the database boundary: an
-- activity row cannot carry an email, NIM, name, phone number, or avatar URL in
-- its metadata, even if a future writer tries.
ALTER TABLE public.app_activity_events
ADD CONSTRAINT app_activity_events_metadata_no_pii CHECK (
  NOT (
    metadata ?| ARRAY['email', 'nim', 'full_name', 'name', 'phone', 'avatar_url']
  )
);


COMMENT ON TABLE public.auth_activity_events IS 'Sanitized sign-in telemetry. Never contains email, NIM, names, document contents, tokens, or credentials.';


COMMENT ON TABLE public.app_activity_events IS 'Sanitized application activity. Never contains email, NIM, names, document contents, tokens, or credentials.';


COMMENT ON TABLE public.app_error_events IS 'Sanitized server error telemetry: route, method, error name, digest. Never contains messages, stacks, headers, bodies, or personal data.';


COMMENT ON COLUMN public.app_activity_events.metadata IS 'Non-identifying extras only. Constraint app_activity_events_metadata_no_pii rejects email, NIM, names, phone numbers, and avatar URLs.';
