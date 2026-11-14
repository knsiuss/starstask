-- Plugin events persistence + per-university toggle (UNPAM plugin improvement 2026-11-05).
-- Additive only: university_plugins, plugin_events, plugin_sync_status.
-- Events are public campus info (kalender/pengumuman), no PII. Writes via service_role (cron).
-- Reads: members of the university can SELECT; anon denied.
CREATE TABLE IF NOT EXISTS public.university_plugins (
  university_id uuid NOT NULL REFERENCES public.universities (id) ON DELETE CASCADE,
  plugin_id text NOT NULL,
  enabled boolean NOT NULL DEFAULT TRUE,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (university_id, plugin_id)
);


COMMENT ON TABLE public.university_plugins IS 'Per-university plugin toggle. Replaces env-only kill-switch for granular control; env UNPAM_PLUGIN_ENABLED remains global kill-switch.';


CREATE TABLE IF NOT EXISTS public.plugin_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities (id) ON DELETE CASCADE,
  plugin_id text NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  starts_at date NOT NULL,
  ends_at date,
  location text,
  description text,
  source_url text,
  program_id text NOT NULL DEFAULT 'semua',
  content_hash text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plugin_events_kind_allowed CHECK (kind IN ('academic-calendar', 'e-learning', 'events')),
  CONSTRAINT plugin_events_program_allowed CHECK (program_id IN ('ti', 'manajemen', 'semua'))
);


CREATE UNIQUE INDEX IF NOT EXISTS plugin_events_unique ON public.plugin_events (university_id, plugin_id, content_hash);


CREATE INDEX IF NOT EXISTS plugin_events_university_start_idx ON public.plugin_events (university_id, starts_at DESC);


CREATE TABLE IF NOT EXISTS public.plugin_sync_status (
  university_id uuid NOT NULL REFERENCES public.universities (id) ON DELETE CASCADE,
  plugin_id text NOT NULL,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  event_count integer NOT NULL DEFAULT 0,
  last_error text,
  PRIMARY KEY (university_id, plugin_id)
);


COMMENT ON TABLE public.plugin_sync_status IS 'Sync observability per plugin: last attempt/success, event count, last error. Shown on /settings/plugins.';


ALTER TABLE public.university_plugins ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.plugin_events ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.plugin_sync_status ENABLE ROW LEVEL SECURITY;


CREATE POLICY university_plugins_member_read ON public.university_plugins FOR
SELECT
  TO authenticated USING (public.is_university_member (university_id));


CREATE POLICY plugin_events_member_read ON public.plugin_events FOR
SELECT
  TO authenticated USING (public.is_university_member (university_id));


CREATE POLICY plugin_sync_status_member_read ON public.plugin_sync_status FOR
SELECT
  TO authenticated USING (public.is_university_member (university_id));


REVOKE ALL ON TABLE public.university_plugins,
public.plugin_events,
public.plugin_sync_status
FROM
  public,
  anon,
  authenticated;


GRANT
SELECT
  ON TABLE public.university_plugins,
  public.plugin_events,
  public.plugin_sync_status TO authenticated;


-- Seed UNPAM plugin enabled
INSERT INTO
  public.university_plugins (university_id, plugin_id, enabled)
SELECT
  id,
  'unpam',
  TRUE
FROM
  public.universities
WHERE
  slug = 'universitas-pamulang'
ON CONFLICT (university_id, plugin_id) DO NOTHING;
