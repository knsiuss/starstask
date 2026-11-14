-- Class admins choose who may join their class by name.
--
-- `classes.join_policy` already existed and `join_class_by_name` already
-- honoured it, but no client could change it, so every class stayed on the
-- invitation-only default. The new function keeps the write inside one
-- SECURITY DEFINER call; the table still has no client UPDATE grant.
CREATE OR REPLACE FUNCTION public.set_class_join_policy (p_class_id uuid, p_policy text) returns boolean language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
begin
  if p_policy not in ('invitation', 'open') then
    raise exception 'Unknown join policy' using errcode = '22023';
  end if;

  if not public.can_manage_class (p_class_id) then
    raise exception 'class admin required' using errcode = '42501';
  end if;

  update public.classes
  set
    join_policy = p_policy
  where
    id = p_class_id;

  if not found then
    raise exception 'class not found' using errcode = 'P0002';
  end if;

  perform public.record_audit(
    'class_join_policy_changed',
    'class',
    p_class_id,
    p_class_id,
    jsonb_build_object('join_policy', p_policy)
  );

  return true;
end;
$$;


COMMENT ON FUNCTION public.set_class_join_policy (uuid, text) IS 'Sets invitation or open-by-name joining for a class. Class manager only.';


REVOKE ALL ON function public.set_class_join_policy (uuid, text)
FROM
  public,
  anon,
  authenticated;


GRANT
EXECUTE ON function public.set_class_join_policy (uuid, text) TO authenticated;
