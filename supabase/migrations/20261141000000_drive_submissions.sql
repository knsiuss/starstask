-- Drive submissions: student picks a file from their own Google Drive,
-- we copy it to our storage (B2/R2/Supabase) and hand the lecturer a
-- share-token link. The lecturer never needs a StarsTask account or
-- access to the student's Drive. Token is the only secret.
create table if not exists public.drive_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  drive_file_id text,
  drive_file_name text not null,
  mime_type text not null,
  file_size integer not null check (file_size between 1 and 10485760),
  storage_path text not null,
  storage_provider text not null check (storage_provider in ('b2','r2','supabase')),
  source text not null default 'google_drive' check (source in ('google_drive','upload')),
  share_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists drive_submissions_assignment_idx
  on public.drive_submissions (assignment_id);
create index if not exists drive_submissions_user_idx
  on public.drive_submissions (user_id);
create index if not exists drive_submissions_token_idx
  on public.drive_submissions (share_token);

alter table public.drive_submissions enable row level security;

drop policy if exists drive_submissions_owner_all on public.drive_submissions;
create policy drive_submissions_owner_all on public.drive_submissions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- No public policy: lecturer access goes through the share token and the
-- service-role client in the /d/[token] route, never through anon/auth RLS.
revoke all on public.drive_submissions from anon, public;
grant select, insert, update, delete on public.drive_submissions to authenticated;
