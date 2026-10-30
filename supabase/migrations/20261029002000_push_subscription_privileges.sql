-- Push subscriptions: owner-scoped reads and endpoint-based removal.
--
-- 1. The column-level grant on push_subscriptions deliberately omitted the
--    endpoint and key material, but it also omitted user_id. Every owner-scoped
--    query filters on user_id, and PostgreSQL needs SELECT privilege on columns
--    read in WHERE, so loading the notification settings failed with 42501.
--    Granting user_id exposes only the caller's own id; RLS still limits rows
--    to the caller, and endpoint/keys remain unreadable.
-- 2. A browser unsubscribes with its endpoint, which clients cannot read. This
--    definer function deletes the matching row for auth.uid() only, so the
--    endpoint never has to be exposed through a table grant.
GRANT
SELECT
  (user_id) ON public.push_subscriptions TO authenticated;


CREATE OR REPLACE FUNCTION public.delete_push_subscription (p_endpoint text) returns boolean language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_user_id uuid := auth.uid ();

  v_deleted integer;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_endpoint is null
  or p_endpoint not like 'https://%' then
    return false;
  end if;

  delete from public.push_subscriptions
  where
    user_id = v_user_id
    and endpoint = p_endpoint;

  get diagnostics v_deleted = row_count;

  return v_deleted > 0;
end;
$$;


COMMENT ON function public.delete_push_subscription (text) IS 'Deletes the caller''s subscription for an endpoint. Returns false when it does not exist.';


REVOKE ALL ON function public.delete_push_subscription (text)
FROM
  public;


GRANT
EXECUTE ON function public.delete_push_subscription (text) TO authenticated;
