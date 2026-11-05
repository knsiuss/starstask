-- Native (FCM) push tokens for the Capacitor mobile shell.
-- =====================================================================
-- Web Push stays in push_subscriptions (endpoint + VAPID keys). FCM device
-- tokens are a different credential shape, so they live in their own table
-- instead of overloading the WebPush columns. The schedulers fan out to
-- both channels; a user with only a native token still gets reminders.
--
-- Conventions mirror the existing push tables: owner-only RLS, SECURITY
-- DEFINER registration functions that derive the actor from auth.uid(),
-- token uniqueness without ownership transfer, and least-privilege grants
-- (REVOKE ALL ... FROM anon).
CREATE TABLE IF NOT EXISTS public.native_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('android', 'ios')),
  device_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_success_at timestamptz,
  disabled_at timestamptz,
  CONSTRAINT native_push_tokens_token_length CHECK (
    char_length(token) >= 10
    AND char_length(token) <= 512
  ),
  CONSTRAINT native_push_tokens_label_length CHECK (
    device_label IS NULL
    OR char_length(btrim(device_label)) <= 60
  )
);


CREATE UNIQUE INDEX if NOT EXISTS native_push_tokens_token_unique ON public.native_push_tokens (token);


CREATE INDEX if NOT EXISTS native_push_tokens_user_idx ON public.native_push_tokens (user_id, disabled_at);


ALTER TABLE public.native_push_tokens enable ROW level security;


CREATE POLICY native_push_tokens_owner_read ON public.native_push_tokens FOR
SELECT
  USING (auth.uid () = user_id);


CREATE POLICY native_push_tokens_owner_insert ON public.native_push_tokens FOR insert
WITH
  CHECK (auth.uid () = user_id);


CREATE POLICY native_push_tokens_owner_update ON public.native_push_tokens
FOR UPDATE
  USING (auth.uid () = user_id)
WITH
  CHECK (auth.uid () = user_id);


CREATE POLICY native_push_tokens_owner_delete ON public.native_push_tokens FOR delete USING (auth.uid () = user_id);


-- ---------------------------------------------------------------------
-- Registration: token is unique per device. If another account already
-- owns it, the conflict update matches no row and this returns null —
-- ownership is never transferred by a re-registration (same rule as
-- register_push_subscription).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_native_push_token (
  p_token text,
  p_platform text,
  p_device_label text DEFAULT NULL
) returns uuid language plpgsql security definer
SET
  search_path TO '' AS $function$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_label text := nullif(btrim(coalesce(p_device_label, '')), '');
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_token is null
     or char_length(p_token) < 10
     or char_length(p_token) > 512 then
    raise exception 'invalid push token' using errcode = '22023';
  end if;

  if p_platform not in ('android', 'ios') then
    raise exception 'invalid push platform' using errcode = '22023';
  end if;

  insert into public.native_push_tokens (user_id, token, platform, device_label)
  values (v_user_id, p_token, p_platform, left(v_label, 60))
  on conflict (token) do update
  set platform = excluded.platform,
      device_label = excluded.device_label,
      disabled_at = null,
      updated_at = now()
  where public.native_push_tokens.user_id = v_user_id
  returning id into v_id;

  return v_id;
end;
$function$;


CREATE OR REPLACE FUNCTION public.delete_native_push_token (p_token text) returns boolean language plpgsql security definer
SET
  search_path TO '' AS $function$
declare
  v_user_id uuid := auth.uid();
  v_deleted boolean := false;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  delete from public.native_push_tokens
  where token = p_token and user_id = v_user_id;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$function$;


REVOKE ALL ON function public.register_native_push_token (text, text, text)
FROM
  anon;


REVOKE ALL ON function public.delete_native_push_token (text)
FROM
  anon;
