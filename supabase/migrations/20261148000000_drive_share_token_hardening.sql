-- Secure Drive share tokens (QA-03).
-- The legacy `share_token` column keeps its rows valid but is no longer the
-- credential: new tokens are 256-bit random values of which only a SHA-256
-- hash is stored, with an expiry and revocation timestamp. Legacy rows are
-- backfilled from their stored token so existing links keep working until
-- they expire or are revoked.

ALTER TABLE public.drive_submissions
  ADD COLUMN IF NOT EXISTS share_token_hash text,
  ADD COLUMN IF NOT EXISTS share_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS share_revoked_at timestamptz;

UPDATE public.drive_submissions
SET share_token_hash = encode(extensions.digest(share_token::text, 'sha256'), 'hex')
WHERE share_token_hash IS NULL;

-- Legacy shares get a 30-day window measured from this migration; new shares
-- always set an explicit expiry at creation.
UPDATE public.drive_submissions
SET share_expires_at = created_at + interval '30 days'
WHERE share_expires_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS drive_submissions_token_hash_idx
  ON public.drive_submissions (share_token_hash)
  WHERE share_revoked_at IS NULL;

COMMENT ON COLUMN public.drive_submissions.share_token IS
  'Legacy plaintext column kept for schema compatibility. The credential is share_token_hash; do not look rows up by this column.';
