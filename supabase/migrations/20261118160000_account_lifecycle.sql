-- Account lifecycle: self-service deactivate and permanent tombstone.
--
-- ADDITIVE ONLY. This migration is delivered as a file and is NOT applied by
-- CI or by any worker. Applying it anywhere requires an explicit owner
-- decision, because it writes to `public.profiles`.
--
-- What this changes:
--   profiles gains five columns and one partial index. No existing column is
--   dropped, renamed, or retyped. `account_status` is deliberately
--   denormalized ('active' | 'deactivated' | 'deleted') so RLS policies and
--   server code can filter cheaply; it is kept consistent by the three RPCs
--   below, not by a cross-column CHECK that could reject rolling deploys.
--
-- What tombstone keeps:
--   `display_name`, `nickname` (stored as display_name), `nim`, `full_name`,
--   `university`, `onboarded_at`, and `declared_class_name` are NEVER nulled
--   or renamed by `tombstone_my_account()`. Academic history (attendance,
--   class membership, reviews, submissions) therefore remains readable with
--   the same name and NIM. Only personal data columns `bio` and `avatar_url`
--   are cleared, and the server-side delete flow is responsible for removing
--   related personal data outside `profiles` (push subscriptions, export jobs,
--   sessions, storage) via the auth admin API.
--
-- Enforcement:
--   These RPCs change lifecycle state only. Login blocking, banned auth
--   users, and the workspace "account deactivated/deleted" screen are enforced
--   by server code (API routes + workspace layout), not by RLS changes here.
--
-- Audit:
--   Each RPC appends one row to `public.audit_logs`. New rows are subject to
--   `audit_logs_university_id_future_not_null` (NOT VALID, enforced for new
--   rows), so the university_id is resolved from the actor's active
--   membership, mirroring `audit_logs_fill_university_id`. The insert is
--   wrapped in a best-effort guard: an audit failure must never block a
--   lifecycle action (same rule as `maybe_grant_ketua_on_join`).
-- ---------------------------------------------------------------------------
-- profiles: lifecycle columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS deactivated_at timestamptz NULL;


ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS deactivation_reason text NULL;


ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;


ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS deletion_reason text NULL;


ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active';


ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_deactivation_reason_length;


ALTER TABLE public.profiles
ADD CONSTRAINT profiles_deactivation_reason_length CHECK (
  deactivation_reason IS NULL
  OR char_length(btrim(deactivation_reason)) <= 500
);


ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_deletion_reason_length;


ALTER TABLE public.profiles
ADD CONSTRAINT profiles_deletion_reason_length CHECK (
  deletion_reason IS NULL
  OR char_length(btrim(deletion_reason)) <= 500
);


ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_account_status_allowed;


ALTER TABLE public.profiles
ADD CONSTRAINT profiles_account_status_allowed CHECK (account_status IN ('active', 'deactivated', 'deleted'));


CREATE INDEX IF NOT EXISTS profiles_account_status_idx ON public.profiles (account_status)
WHERE
  account_status <> 'active';


COMMENT ON COLUMN public.profiles.deactivated_at IS 'When the owner deactivated their own account. NULL while the account is active or never deactivated. Cleared by reactivate_my_account().';


COMMENT ON COLUMN public.profiles.deactivation_reason IS 'Optional free-text reason captured at deactivation (trimmed, max 500 chars). Audit/triage use only; never shown publicly.';


COMMENT ON COLUMN public.profiles.deleted_at IS 'When tombstone_my_account() ran. Non-NULL means the account is permanently deleted: sign-in is blocked and personal data columns are cleared. Never cleared.';


COMMENT ON COLUMN public.profiles.deletion_reason IS 'Optional free-text reason captured at tombstone (trimmed, max 500 chars). Audit/triage use only; never shown publicly.';


COMMENT ON COLUMN public.profiles.account_status IS 'Denormalized lifecycle state: active, deactivated, or deleted. Kept consistent by deactivate/reactivate/tombstone RPCs. Cheap filter for RLS and server code. Tombstone keeps display_name, nickname, and nim verbatim.';


-- ---------------------------------------------------------------------------
-- deactivate_my_account: reversible soft delete
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.deactivate_my_account (p_reason text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_row public.profiles;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_metadata jsonb := '{}'::jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF v_reason IS NOT NULL AND char_length(v_reason) > 500 THEN
    RAISE EXCEPTION 'invalid reason: 500 characters maximum' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_row
  FROM public.profiles p
  WHERE p.id = v_user
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_row.account_status = 'deleted' THEN
    RAISE EXCEPTION 'account has been deleted' USING ERRCODE = '22023';
  END IF;

  -- Idempotent re-call: keep the first deactivation timestamp and the first
  -- reason, do not emit a second audit row for an action that changed nothing.
  IF v_row.account_status = 'deactivated' THEN
    RETURN jsonb_build_object('status', 'deactivated', 'deactivated_at', v_row.deactivated_at);
  END IF;

  UPDATE public.profiles
  SET deactivated_at = now(),
      deactivation_reason = v_reason,
      account_status = 'deactivated'
  WHERE id = v_user
  RETURNING deactivated_at INTO v_row.deactivated_at;

  IF v_reason IS NOT NULL THEN
    v_metadata := jsonb_build_object('reason', v_reason);
  END IF;

  BEGIN
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, university_id, metadata)
    VALUES (
      v_user,
      'account_deactivated',
      'profile',
      v_user,
      (SELECT um.university_id FROM public.university_memberships um
       WHERE um.user_id = v_user AND um.status = 'active'
       ORDER BY um.created_at LIMIT 1),
      v_metadata
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- audit is best-effort; it must not block a lifecycle action
  END;

  RETURN jsonb_build_object('status', 'deactivated', 'deactivated_at', v_row.deactivated_at);
END;
$$;


-- ---------------------------------------------------------------------------
-- reactivate_my_account: undo a deactivation, never a tombstone
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reactivate_my_account () RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_row public.profiles;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row
  FROM public.profiles p
  WHERE p.id = v_user
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_row.account_status = 'deleted' THEN
    RAISE EXCEPTION 'account has been deleted' USING ERRCODE = '22023';
  END IF;

  IF v_row.account_status <> 'deactivated' THEN
    RAISE EXCEPTION 'account is not deactivated' USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles
  SET deactivated_at = NULL,
      deactivation_reason = NULL,
      account_status = 'active'
  WHERE id = v_user;

  BEGIN
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, university_id, metadata)
    VALUES (
      v_user,
      'account_reactivated',
      'profile',
      v_user,
      (SELECT um.university_id FROM public.university_memberships um
       WHERE um.user_id = v_user AND um.status = 'active'
       ORDER BY um.created_at LIMIT 1),
      '{}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- audit is best-effort; it must not block a lifecycle action
  END;

  RETURN jsonb_build_object('status', 'active');
END;
$$;


-- ---------------------------------------------------------------------------
-- tombstone_my_account: irreversible permanent delete (keeps name and NIM)
-- ---------------------------------------------------------------------------
-- Never touches display_name, nickname, nim, full_name, university,
-- declared_class_name, or onboarded_at. Clears bio and avatar_url only.
CREATE OR REPLACE FUNCTION public.tombstone_my_account (p_reason text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_row public.profiles;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_metadata jsonb := '{}'::jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF v_reason IS NOT NULL AND char_length(v_reason) > 500 THEN
    RAISE EXCEPTION 'invalid reason: 500 characters maximum' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_row
  FROM public.profiles p
  WHERE p.id = v_user
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found' USING ERRCODE = 'P0002';
  END IF;

  -- Delete itself is the one call allowed on a deleted account: idempotent
  -- re-try, keeps the original deleted_at, no second audit row.
  IF v_row.account_status = 'deleted' THEN
    RETURN jsonb_build_object('status', 'deleted', 'deleted_at', v_row.deleted_at);
  END IF;

  UPDATE public.profiles
  SET deleted_at = now(),
      deletion_reason = v_reason,
      account_status = 'deleted',
      bio = NULL,
      avatar_url = NULL
  WHERE id = v_user
  RETURNING deleted_at INTO v_row.deleted_at;

  IF v_reason IS NOT NULL THEN
    v_metadata := jsonb_build_object('reason', v_reason);
  END IF;

  BEGIN
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, university_id, metadata)
    VALUES (
      v_user,
      'account_tombstoned',
      'profile',
      v_user,
      (SELECT um.university_id FROM public.university_memberships um
       WHERE um.user_id = v_user AND um.status = 'active'
       ORDER BY um.created_at LIMIT 1),
      v_metadata
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- audit is best-effort; it must not block a lifecycle action
  END;

  RETURN jsonb_build_object('status', 'deleted', 'deleted_at', v_row.deleted_at);
END;
$$;


-- ---------------------------------------------------------------------------
-- Function privileges: authenticated only, never anon
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.deactivate_my_account (text)
FROM
  PUBLIC;


REVOKE ALL ON FUNCTION public.deactivate_my_account (text)
FROM
  anon;


GRANT
EXECUTE ON FUNCTION public.deactivate_my_account (text) TO authenticated;


REVOKE ALL ON FUNCTION public.reactivate_my_account ()
FROM
  PUBLIC;


REVOKE ALL ON FUNCTION public.reactivate_my_account ()
FROM
  anon;


GRANT
EXECUTE ON FUNCTION public.reactivate_my_account () TO authenticated;


REVOKE ALL ON FUNCTION public.tombstone_my_account (text)
FROM
  PUBLIC;


REVOKE ALL ON FUNCTION public.tombstone_my_account (text)
FROM
  anon;


GRANT
EXECUTE ON FUNCTION public.tombstone_my_account (text) TO authenticated;
