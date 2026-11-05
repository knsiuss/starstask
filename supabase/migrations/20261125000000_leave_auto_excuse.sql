-- Auto-excuse sessions created after an approved leave.
--
-- review_leave_request() already marks existing sessions excused on
-- approval, but a session created later inside the approved window was
-- left untouched and could be finalized as absent. This trigger mirrors
-- the approval predicate exactly, so a future meeting for a student on
-- approved leave starts as excused instead of unrecorded.

CREATE OR REPLACE FUNCTION public.excuse_approved_leave_for_session () returns trigger language plpgsql
SET
  search_path = public,
  pg_temp AS $$
begin
  if new.status = 'cancelled' then
    return new;
  end if;

  insert into public.discussion_session_checkins (
    session_id,
    user_id,
    status,
    method,
    note,
    reviewed_at
  )
  select
    new.id,
    lr.student_id,
    'excused',
    'manual',
    'Excused after an approved absence request.',
    now()
  from
    public.leave_requests lr
  join public.class_members m on m.class_id = new.class_id
    and m.user_id = lr.student_id
    and m.joined_at <= new.starts_at
  where
    lr.class_id = new.class_id
    and lr.status = 'approved'
    and lr.leave_start_date is not null
    and lr.leave_end_date is not null
    and (new.starts_at at time zone 'Asia/Jakarta')::date between lr.leave_start_date
    and lr.leave_end_date
    and (
      cardinality (coalesce (lr.subject_ids, '{}')) = 0
      or new.subject_id = any (lr.subject_ids)
    )
  on conflict (session_id, user_id) do nothing;

  return new;
end;
$$;


DROP TRIGGER if EXISTS discussion_sessions_excuse_approved_leave ON public.discussion_sessions;


CREATE TRIGGER discussion_sessions_excuse_approved_leave
AFTER INSERT ON public.discussion_sessions FOR EACH ROW
EXECUTE FUNCTION public.excuse_approved_leave_for_session ();


COMMENT ON FUNCTION public.excuse_approved_leave_for_session () IS 'Inserts an excused check-in for every student whose approved leave covers a newly created session. Mirrors the attendance side effect of review_leave_request().';
