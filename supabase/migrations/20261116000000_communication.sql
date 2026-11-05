-- Phase 5F: communication. Additive only.
-- Announcements: NEW (formal, class-scoped). Discussions: ISOLATED proposal
-- (scope class|offering unresolved — table built but no app wiring, flagged).
-- Social feed: decision-gated, NO table (ADR-016). Notifications: reuse outbox.

CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities (id) ON DELETE RESTRICT,
  class_id uuid NOT NULL,
  offering_id uuid,
  author uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  title text NOT NULL,
  body text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT announcements_title_length CHECK (char_length(btrim(title)) BETWEEN 3 AND 200),
  CONSTRAINT announcements_body_length CHECK (char_length(btrim(body)) BETWEEN 1 AND 20000),
  CONSTRAINT announcements_class_same_university FOREIGN KEY (class_id, university_id) REFERENCES public.classes (id, university_id) ON DELETE CASCADE,
  CONSTRAINT announcements_offering_same_university FOREIGN KEY (offering_id, university_id) REFERENCES public.course_offerings (id, university_id) ON DELETE CASCADE,
  CONSTRAINT announcements_publish_consistency CHECK ((published_at IS NOT NULL) = (archived_at IS NULL OR published_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS announcements_id_university_unique ON public.announcements (id, university_id);
CREATE INDEX IF NOT EXISTS announcements_class_published_idx ON public.announcements (class_id, published_at DESC) WHERE published_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS announcements_offering_idx ON public.announcements (offering_id) WHERE offering_id IS NOT NULL;
DROP TRIGGER IF EXISTS announcements_set_updated_at ON public.announcements;
CREATE TRIGGER announcements_set_updated_at BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.announcement_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities (id) ON DELETE RESTRICT,
  announcement_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT announcement_reads_unique UNIQUE (announcement_id, user_id),
  CONSTRAINT announcement_reads_same_university FOREIGN KEY (announcement_id, university_id) REFERENCES public.announcements (id, university_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS announcement_reads_user_idx ON public.announcement_reads (user_id, read_at DESC);

-- ISOLATED: discussion scope (class vs offering) UNRESOLVED (36#3). Table exists
-- for schema review only; no RLS write, no app code, no RPC. Do not use in prod.
CREATE TABLE IF NOT EXISTS public.discussion_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities (id) ON DELETE RESTRICT,
  class_id uuid NOT NULL,
  offering_id uuid,
  scope text NOT NULL,
  title text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT discussion_threads_scope_allowed CHECK (scope IN ('class','offering')),
  CONSTRAINT discussion_threads_scope_consistency CHECK ((scope='offering') = (offering_id IS NOT NULL)),
  CONSTRAINT discussion_threads_title_length CHECK (char_length(btrim(title)) BETWEEN 3 AND 200),
  CONSTRAINT discussion_threads_class_same_university FOREIGN KEY (class_id, university_id) REFERENCES public.classes (id, university_id) ON DELETE CASCADE,
  CONSTRAINT discussion_threads_offering_same_university FOREIGN KEY (offering_id, university_id) REFERENCES public.course_offerings (id, university_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS discussion_threads_class_idx ON public.discussion_threads (class_id, created_at DESC);
COMMENT ON TABLE public.discussion_threads IS 'ISOLATED PROPOSAL (Phase 5F): scope class-vs-offering unresolved. No app/RPC wiring. Decision-gated.';
DROP TRIGGER IF EXISTS discussion_threads_set_updated_at ON public.discussion_threads;
CREATE TRIGGER discussion_threads_set_updated_at BEFORE UPDATE ON public.discussion_threads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.notification_events ADD COLUMN IF NOT EXISTS university_id uuid REFERENCES public.universities (id) ON DELETE RESTRICT;
ALTER TABLE public.notification_deliveries ADD COLUMN IF NOT EXISTS university_id uuid REFERENCES public.universities (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS notification_events_university_idx ON public.notification_events (university_id, created_at DESC) WHERE university_id IS NOT NULL;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['announcements','announcement_reads','discussion_threads'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM public, anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', t);
  END LOOP;
END $$;
DROP POLICY IF EXISTS announcements_member_read ON public.announcements;
CREATE POLICY announcements_member_read ON public.announcements FOR SELECT TO authenticated USING (public.is_class_member(class_id) OR public.is_platform_admin());
DROP POLICY IF EXISTS announcement_reads_owner_read ON public.announcement_reads;
CREATE POLICY announcement_reads_owner_read ON public.announcement_reads FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()) OR public.is_platform_admin());
DROP POLICY IF EXISTS discussion_threads_member_read ON public.discussion_threads;
CREATE POLICY discussion_threads_member_read ON public.discussion_threads FOR SELECT TO authenticated USING (public.is_class_member(class_id) OR public.is_platform_admin());
