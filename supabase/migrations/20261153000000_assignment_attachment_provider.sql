-- Track which storage backend each attachment lives in so reads, signed
-- URLs, and cleanup can reach the right store. Existing rows stay on
-- Supabase (`supabase` default); new uploads go through the
-- B2 -> R2 -> Supabase chain in lib/storage/b2.ts.
alter table public.assignment_attachments
  add column if not exists storage_provider text not null default 'supabase'
  check (storage_provider in ('b2', 'r2', 'supabase'));
