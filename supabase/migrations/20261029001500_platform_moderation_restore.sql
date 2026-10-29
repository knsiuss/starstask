-- Restore is a platform-level decision.
--
-- Unpublishing and archiving remain available to a class admin for their own
-- class, but only a platform admin may restore content. Otherwise a class admin
-- could silently reverse a platform moderation restriction, which the product
-- rules explicitly forbid.
CREATE OR REPLACE FUNCTION public.moderate_assignment (
  p_assignment_id uuid,
  p_action text,
  p_reason text DEFAULT NULL
) returns text language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_actor uuid := (
    select
      auth.uid ()
  );
  v_assignment public.assignments;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_status text;
begin if v_actor is null then raise exception 'authentication required' using errcode = '42501';
end if;
if p_action not in ('unpublish', 'archive', 'restore') then raise exception 'invalid moderation action' using errcode = '22023';
end if;
select
  * into v_assignment
from
  public.assignments
where
  id = p_assignment_id for
update;
if not found then raise exception 'assignment not found' using errcode = 'P0002';
end if;
-- Restoring is reserved for the platform. A class admin may hide content in
-- their own class but cannot undo a platform decision.
if p_action = 'restore' then if not public.is_platform_admin () then raise exception 'platform admin required to restore' using errcode = '42501';
end if;
if v_assignment.status not in ('unpublished', 'archived') then raise exception 'only unpublished or archived assignments can be restored' using errcode = '22023';
end if;
v_status := 'published';
else if v_assignment.class_id is not null then if not public.can_manage_class (v_assignment.class_id) then raise exception 'class admin or platform admin required' using errcode = '42501';
end if;
elsif not public.is_platform_admin () then raise exception 'platform admin required' using errcode = '42501';
end if;
if v_reason is null
or char_length(v_reason) < 3 then raise exception 'moderation reason required' using errcode = '22023';
end if;
v_status := case
  when p_action = 'archive' then 'archived'
  else 'unpublished'
end;
end if;
update public.assignments
set
  status = v_status,
  published_at = case
    when v_status = 'published' then coalesce(published_at, now())
    else published_at
  end
where
  id = p_assignment_id;
insert into public.assignment_reviews (assignment_id, reviewer_id, decision, reason)
values (
  p_assignment_id,
  v_actor,
  case
    when p_action = 'restore' then 'restored'
    when p_action = 'archive' then 'archived'
    else 'unpublished'
  end,
  v_reason
);
perform public.record_audit(
  'assignment_' || p_action,
  'assignment',
  p_assignment_id,
  v_assignment.class_id,
  '{}'::jsonb
);
perform public.enqueue_notification_event(
  v_assignment.user_id,
  'moderation_required',
  'assignment_moderation:' || p_assignment_id || ':' || v_status || ':' || extract(epoch from now()),
  jsonb_build_object(
    'title',
    'Assignment visibility changed',
    'body',
    'A moderator changed the visibility of your assignment.',
    'url',
    '/my-assignments'
  )
);
return v_status;
end;
$$;


REVOKE ALL ON function public.moderate_assignment (uuid, text, text)
FROM
  public;


GRANT
EXECUTE ON function public.moderate_assignment (uuid, text, text) TO authenticated;
