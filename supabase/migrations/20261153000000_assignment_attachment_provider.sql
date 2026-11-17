-- Track which storage backend each attachment lives in so reads, signed
-- URLs, and cleanup can reach the right store. Existing rows stay on
-- Supabase (`supabase` default); new uploads go through the
-- B2 -> R2 -> Supabase chain in lib/storage/b2.ts.
ALTER TABLE public.assignment_attachments
ADD COLUMN IF NOT EXISTS storage_provider text NOT NULL DEFAULT 'supabase' CHECK (storage_provider IN ('b2', 'r2', 'supabase'));
