-- Persistent Google Drive OAuth connections (one per user).
-- Tokens encrypted AES-256-GCM server-side, never granted to clients.
-- Same pattern as google_calendar_connections.
create table if not exists public.google_drive_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  scope text not null,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text,
  token_expires_at timestamptz not null,
  status text not null default 'connected',
  last_error_category text,
  drive_email text,
  connected_at timestamptz not null default now(),
  last_refreshed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint google_drive_connections_status_allowed check (status in ('connected','revoked','error')),
  constraint google_drive_connections_scope_length check (char_length(scope) between 1 and 500),
  constraint google_drive_connections_access_cipher_length check (char_length(access_token_ciphertext) between 40 and 4000),
  constraint google_drive_connections_refresh_cipher_length check (
    refresh_token_ciphertext is null
    or char_length(refresh_token_ciphertext) between 40 and 4000
  ),
  constraint google_drive_connections_error_length check (
    last_error_category is null
    or char_length(last_error_category) between 1 and 40
  )
);

comment on table public.google_drive_connections is 'Encrypted Google Drive OAuth credentials. Token columns never granted to clients.';

create trigger google_drive_connections_set_updated_at
before update on public.google_drive_connections for each row
execute function public.set_updated_at();

alter table public.google_drive_connections enable row level security;

revoke all on public.google_drive_connections from anon, authenticated;

grant select (user_id, scope, status, connected_at, last_refreshed_at, updated_at, last_error_category, drive_email)
  on public.google_drive_connections to authenticated;

drop policy if exists google_drive_connections_owner_read on public.google_drive_connections;
create policy google_drive_connections_owner_read on public.google_drive_connections for
select to authenticated using ((select auth.uid()) = user_id);
