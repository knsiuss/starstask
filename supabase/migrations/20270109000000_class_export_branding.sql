-- Per-class institutional branding for the Excel attendance/grade export.
-- One row per class, keyed by class_id. Reads are member-scoped, writes are
-- manager-only. No anonymous access exists on this table.
CREATE TABLE public.class_export_branding (
  class_id uuid PRIMARY KEY REFERENCES public.classes (id) ON DELETE CASCADE,
  university_name text NOT NULL DEFAULT '',
  university_short_name text,
  university_tagline text,
  faculty text,
  department text,
  study_program text,
  address text,
  city text,
  official_website text,
  official_email text,
  contact_number text,
  document_title text NOT NULL DEFAULT 'Lembar Rekapitulasi Kehadiran dan Nilai Mahasiswa',
  footer_text text,
  product_name text NOT NULL DEFAULT 'Aphelion',
  product_tagline text NOT NULL DEFAULT 'Academic Productivity',
  product_logo_url text NOT NULL DEFAULT '/aphelion-logo.png',
  product_footer text,
  branding_enabled boolean NOT NULL DEFAULT TRUE,
  passing_threshold numeric NOT NULL DEFAULT 60,
  university_logo_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);


CREATE TRIGGER class_export_branding_set_updated_at
BEFORE UPDATE ON public.class_export_branding FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();


ALTER TABLE public.class_export_branding ENABLE ROW LEVEL SECURITY;


REVOKE ALL ON public.class_export_branding
FROM
  anon,
  authenticated;


GRANT
SELECT
  (
    class_id,
    university_name,
    university_short_name,
    university_tagline,
    faculty,
    department,
    study_program,
    address,
    city,
    official_website,
    official_email,
    contact_number,
    document_title,
    footer_text,
    product_name,
    product_tagline,
    product_logo_url,
    product_footer,
    branding_enabled,
    passing_threshold,
    university_logo_url,
    created_at,
    updated_at
  ) ON public.class_export_branding TO authenticated;


GRANT INSERT,
UPDATE (
  class_id,
  university_name,
  university_short_name,
  university_tagline,
  faculty,
  department,
  study_program,
  address,
  city,
  official_website,
  official_email,
  contact_number,
  document_title,
  footer_text,
  product_name,
  product_tagline,
  product_logo_url,
  product_footer,
  branding_enabled,
  passing_threshold,
  university_logo_url
) ON public.class_export_branding TO authenticated;


CREATE POLICY class_export_branding_member_select ON public.class_export_branding FOR
SELECT
  TO authenticated USING (
    (
      SELECT
        public.is_class_member (class_id)
    )
    OR (
      SELECT
        public.is_platform_admin ()
    )
  );


CREATE POLICY class_export_branding_manager_insert ON public.class_export_branding FOR INSERT TO authenticated
WITH
  CHECK (
    (
      SELECT
        public.can_manage_class (class_id)
    )
    OR (
      SELECT
        public.is_platform_admin ()
    )
  );


CREATE POLICY class_export_branding_manager_update ON public.class_export_branding
FOR UPDATE
  TO authenticated USING (
    (
      SELECT
        public.can_manage_class (class_id)
    )
    OR (
      SELECT
        public.is_platform_admin ()
    )
  )
WITH
  CHECK (
    (
      SELECT
        public.can_manage_class (class_id)
    )
    OR (
      SELECT
        public.is_platform_admin ()
    )
  );
