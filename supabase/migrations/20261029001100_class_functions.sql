-- Class workflow functions.
--
-- Every privileged state transition lives here so it is atomic and cannot be
-- forged by a browser client:
--   authenticated  -> apply_for_class, revise/withdraw, accept_class_invitation,
--                     create/revoke invitations, submit/review assignments,
--                     moderate assignments
--   platform admin -> decide_class_application, assign/revoke class admin,
--                     set_class_status
--   internal only  -> record_audit, enqueue_notification_event
--
-- Predicates are SECURITY DEFINER on purpose: RLS policies call them, and a
-- policy that queried class_members directly would recurse.
create or replace function public.is_platform_admin () returns boolean language sql stable security definer
SET
  search_path = '' AS $$
select
  exists (
    select
      1
    from
      public.platform_admins pa
    where
      pa.user_id = (
        select
          auth.uid ()
      )
  );
$$;


create or replace function public.is_class_member (p_class_id uuid) returns boolean language sql stable security definer
SET
  search_path = '' AS $$
select
  exists (
    select
      1
    from
      public.class_members m
    where
      m.class_id = p_class_id
      and m.user_id = (
        select
          auth.uid ()
      )
  );
$$;


create or replace function public.is_class_admin (p_class_id uuid) returns boolean language sql stable security definer
SET
  search_path = '' AS $$
select
  exists (
    select
      1
    from
      public.class_admins ca
    where
      ca.class_id = p_class_id
      and ca.user_id = (
        select
          auth.uid ()
      )
  );
$$;


create or replace function public.can_manage_class (p_class_id uuid) returns boolean language sql stable security definer
SET
  search_path = '' AS $$
select
  public.is_platform_admin ()
  or public.is_class_admin (p_class_id);
$$;


-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------
create or replace function public.record_audit (
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_class_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
) returns void language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$ begin
insert into public.audit_logs (actor_id, action, entity_type, entity_id, class_id, metadata)
values (
    (
      select
        auth.uid ()
    ),
    p_action,
    p_entity_type,
    p_entity_id,
    p_class_id,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;


-- Queues a push event only for users who opted in and still have an active
-- device. Late delivery of a one-off event is useless, so the filter happens
-- here rather than at send time.
create or replace function public.enqueue_notification_event (
  p_user_id uuid,
  p_kind text,
  p_dedupe_key text,
  p_payload jsonb
) returns void language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$ begin if p_user_id is null then return;
end if;
if not exists (
  select
    1
  from
    public.notification_preferences p
  where
    p.user_id = p_user_id
    and p.push_enabled
)
or not exists (
  select
    1
  from
    public.push_subscriptions s
  where
    s.user_id = p_user_id
    and s.disabled_at is null
) then return;
end if;
insert into public.notification_events (user_id, kind, dedupe_key, payload)
values (p_user_id, p_kind, p_dedupe_key, coalesce(p_payload, '{}'::jsonb)) on conflict (dedupe_key) do nothing;
end;
$$;


-- ---------------------------------------------------------------------------
-- Class applications
-- ---------------------------------------------------------------------------
create or replace function public.apply_for_class (
  p_proposed_slug text,
  p_proposed_name text,
  p_course_name text,
  p_semester text,
  p_academic_year text,
  p_description text,
  p_reason text,
  p_institution text DEFAULT NULL,
  p_lecturer_name text DEFAULT NULL,
  p_supporting_info text DEFAULT NULL
) returns uuid language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_user uuid := (
    select
      auth.uid ()
  );
  v_slug text := lower(btrim(coalesce(p_proposed_slug, '')));
  v_id uuid;
begin if v_user is null then raise exception 'authentication required' using errcode = '42501';
end if;
insert into public.class_applications (
  applicant_id,
  proposed_slug,
  proposed_name,
  course_name,
  institution,
  lecturer_name,
  semester,
  academic_year,
  description,
  reason,
  supporting_info
)
values (
  v_user,
  v_slug,
  btrim(p_proposed_name),
  btrim(p_course_name),
  nullif(btrim(coalesce(p_institution, '')), ''),
  nullif(btrim(coalesce(p_lecturer_name, '')), ''),
  btrim(p_semester),
  btrim(p_academic_year),
  btrim(p_description),
  btrim(p_reason),
  nullif(btrim(coalesce(p_supporting_info, '')), '')
)
returning
  id into v_id;
perform public.record_audit(
  'class_application_submitted',
  'class_application',
  v_id,
  null,
  jsonb_build_object('proposed_slug', v_slug)
);
return v_id;
exception
  when unique_violation then raise exception 'an open application for this class already exists' using errcode = '23505';
end;
$$;


create or replace function public.revise_class_application (
  p_application_id uuid,
  p_proposed_slug text,
  p_proposed_name text,
  p_course_name text,
  p_semester text,
  p_academic_year text,
  p_description text,
  p_reason text,
  p_institution text DEFAULT NULL,
  p_lecturer_name text DEFAULT NULL,
  p_supporting_info text DEFAULT NULL
) returns boolean language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_user uuid := (
    select
      auth.uid ()
  );
  v_id uuid;
begin if v_user is null then raise exception 'authentication required' using errcode = '42501';
end if;
update public.class_applications
set
  proposed_slug = lower(btrim(coalesce(p_proposed_slug, ''))),
  proposed_name = btrim(p_proposed_name),
  course_name = btrim(p_course_name),
  institution = nullif(btrim(coalesce(p_institution, '')), ''),
  lecturer_name = nullif(btrim(coalesce(p_lecturer_name, '')), ''),
  semester = btrim(p_semester),
  academic_year = btrim(p_academic_year),
  description = btrim(p_description),
  reason = btrim(p_reason),
  supporting_info = nullif(btrim(coalesce(p_supporting_info, '')), ''),
  status = 'pending',
  reviewed_by = null,
  reviewed_at = null,
  decision_note = null,
  created_class_id = null
where
  id = p_application_id
  and applicant_id = v_user
  and status in ('pending', 'rejected')
returning
  id into v_id;
if v_id is null then raise exception 'application not found or not editable' using errcode = 'P0002';
end if;
perform public.record_audit(
  'class_application_revised',
  'class_application',
  v_id,
  null,
  '{}'::jsonb
);
return true;
exception
  when unique_violation then raise exception 'an open application for this class already exists' using errcode = '23505';
end;
$$;


create or replace function public.withdraw_class_application (p_application_id uuid) returns boolean language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_id uuid;
begin update public.class_applications
set
  status = 'withdrawn'
where
  id = p_application_id
  and applicant_id = (
    select
      auth.uid ()
  )
  and status = 'pending'
returning
  id into v_id;
if v_id is null then raise exception 'application not found or not pending' using errcode = 'P0002';
end if;
perform public.record_audit(
  'class_application_withdrawn',
  'class_application',
  v_id,
  null,
  '{}'::jsonb
);
return true;
end;
$$;


-- Approval creates the class and, only when the platform admin asks for it, the
-- applicant's class admin role. The applicant never triggers this themselves.
create or replace function public.decide_class_application (
  p_application_id uuid,
  p_decision text,
  p_note text DEFAULT NULL,
  p_grant_class_admin boolean DEFAULT FALSE
) returns uuid language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_reviewer uuid := (
    select
      auth.uid ()
  );
  v_app public.class_applications;
  v_class_id uuid;
  v_course_id uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin if not public.is_platform_admin () then raise exception 'platform admin required' using errcode = '42501';
end if;
if p_decision not in ('approved', 'rejected') then raise exception 'invalid decision' using errcode = '22023';
end if;
select
  * into v_app
from
  public.class_applications
where
  id = p_application_id for
update;
if not found then raise exception 'application not found' using errcode = 'P0002';
end if;
if v_app.status <> 'pending' then raise exception 'application is not pending' using errcode = '22023';
end if;
if p_decision = 'rejected' then if v_note is null
or char_length(v_note) < 3 then raise exception 'rejection reason required' using errcode = '22023';
end if;
update public.class_applications
set
  status = 'rejected',
  reviewed_by = v_reviewer,
  reviewed_at = now(),
  decision_note = v_note
where
  id = v_app.id;
insert into public.class_application_reviews (application_id, reviewer_id, decision, note)
values (v_app.id, v_reviewer, 'rejected', v_note);
perform public.record_audit(
  'class_application_rejected',
  'class_application',
  v_app.id,
  null,
  '{}'::jsonb
);
perform public.enqueue_notification_event(
  v_app.applicant_id,
  'class_application_rejected',
  'class_application:' || v_app.id || ':rejected',
  jsonb_build_object(
    'title',
    'Class application rejected',
    'body',
    'Open StarsTask to read the reviewer note and resubmit if needed.',
    'url',
    '/dashboard'
  )
);
return null;
end if;
if exists (
  select
    1
  from
    public.classes c
  where
    c.slug = v_app.proposed_slug
) then raise exception 'class slug already taken' using errcode = '23505';
end if;
insert into public.courses (name)
values (v_app.course_name) on conflict (normalized_name) do
update
set
  name = excluded.name returning id into v_course_id;
insert into public.classes (
  slug,
  name,
  description,
  course_id,
  course_name,
  institution,
  lecturer_name,
  semester,
  academic_year,
  created_by
)
values (
  v_app.proposed_slug,
  v_app.proposed_name,
  v_app.description,
  v_course_id,
  v_app.course_name,
  v_app.institution,
  v_app.lecturer_name,
  v_app.semester,
  v_app.academic_year,
  v_reviewer
)
returning
  id into v_class_id;
insert into public.class_members (class_id, user_id, joined_via)
values (v_class_id, v_app.applicant_id, 'platform_assignment');
if p_grant_class_admin then
insert into public.class_admins (class_id, user_id, assigned_by)
values (v_class_id, v_app.applicant_id, v_reviewer);
end if;
update public.class_applications
set
  status = 'approved',
  reviewed_by = v_reviewer,
  reviewed_at = now(),
  decision_note = v_note,
  created_class_id = v_class_id
where
  id = v_app.id;
insert into public.class_application_reviews (application_id, reviewer_id, decision, note)
values (v_app.id, v_reviewer, 'approved', v_note);
perform public.record_audit(
  'class_application_approved',
  'class_application',
  v_app.id,
  v_class_id,
  jsonb_build_object('slug', v_app.proposed_slug)
);
perform public.enqueue_notification_event(
  v_app.applicant_id,
  'class_application_approved',
  'class_application:' || v_app.id || ':approved',
  jsonb_build_object(
    'title',
    'Class application approved',
    'body',
    'Your class is live on StarsTask.',
    'url',
    '/classes/' || v_app.proposed_slug
  )
);
return v_class_id;
end;
$$;


-- ---------------------------------------------------------------------------
-- Invitations
-- ---------------------------------------------------------------------------
create or replace function public.create_class_invitation (
  p_class_id uuid,
  p_token_hash text,
  p_expires_at timestamptz,
  p_max_uses integer DEFAULT 1,
  p_email_restriction text DEFAULT NULL
) returns uuid language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_user uuid := (
    select
      auth.uid ()
  );
  v_hash text := lower(btrim(coalesce(p_token_hash, '')));
  v_email text := nullif(lower(btrim(coalesce(p_email_restriction, ''))), '');
  v_id uuid;
  v_invitee uuid;
begin if v_user is null then raise exception 'authentication required' using errcode = '42501';
end if;
if not public.can_manage_class (p_class_id) then raise exception 'class admin required' using errcode = '42501';
end if;
if not exists (
  select
    1
  from
    public.classes c
  where
    c.id = p_class_id
    and c.status = 'active'
) then raise exception 'class is not active' using errcode = '22023';
end if;
if v_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid invitation token hash' using errcode = '22023';
end if;
if p_expires_at is null
or p_expires_at <= now()
or p_expires_at > now() + interval '90 days' then raise exception 'invalid invitation expiry' using errcode = '22023';
end if;
insert into public.class_invitations (
  class_id,
  created_by,
  token_hash,
  email_restriction,
  expires_at,
  max_uses
)
values (
  p_class_id,
  v_user,
  v_hash,
  v_email,
  p_expires_at,
  coalesce(p_max_uses, 1)
)
returning
  id into v_id;
perform public.record_audit(
  'class_invitation_created',
  'class_invitation',
  v_id,
  p_class_id,
  jsonb_build_object(
    'max_uses',
    coalesce(p_max_uses, 1),
    'email_restricted',
    v_email is not null
  )
);
-- A link invite cannot notify anyone in particular; an email-restricted invite
-- can, so the named user hears about it without exposing the token.
if v_email is not null then
select
  u.id into v_invitee
from
  auth.users u
where
  lower(u.email) = v_email
limit
  1;
if v_invitee is not null then
perform public.enqueue_notification_event(
  v_invitee,
  'class_invitation',
  'class_invitation:' || v_id,
  jsonb_build_object(
    'title',
    'Class invitation',
    'body',
    'You were invited to join a class on StarsTask.',
    'url',
    '/dashboard'
  )
);
end if;
end if;
return v_id;
end;
$$;


create or replace function public.revoke_class_invitation (p_invitation_id uuid) returns boolean language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_class_id uuid;
begin select
  class_id into v_class_id
from
  public.class_invitations
where
  id = p_invitation_id
  and revoked_at is null;
if v_class_id is null then raise exception 'invitation not found or already revoked' using errcode = 'P0002';
end if;
if not public.can_manage_class (v_class_id) then raise exception 'class admin required' using errcode = '42501';
end if;
update public.class_invitations
set
  revoked_at = now(),
  revoked_by = (
    select
      auth.uid ()
  )
where
  id = p_invitation_id;
perform public.record_audit(
  'class_invitation_revoked',
  'class_invitation',
  p_invitation_id,
  v_class_id,
  '{}'::jsonb
);
return true;
end;
$$;


-- The raw token never reaches the database: only its SHA-256 hex digest is
-- compared. Expiry, revocation, usage limits, class state, and the optional
-- email restriction are all verified here, on the server.
create or replace function public.accept_class_invitation (p_token text) returns uuid language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_user uuid := (
    select
      auth.uid ()
  );
  v_hash text;
  v_inv public.class_invitations;
  v_email text;
  v_class_status text;
begin if v_user is null then raise exception 'authentication required' using errcode = '42501';
end if;
if p_token is null
or char_length(p_token) < 20
or char_length(p_token) > 200 then raise exception 'invalid invitation token' using errcode = '22023';
end if;
v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');
select
  * into v_inv
from
  public.class_invitations
where
  token_hash = v_hash for
update;
if not found then raise exception 'invitation not found' using errcode = 'P0002';
end if;
-- Idempotent first: an existing member gets the class back without consuming a
-- use, and without failing on a link that is now expired or fully used.
if exists (
  select
    1
  from
    public.class_members m
  where
    m.class_id = v_inv.class_id
    and m.user_id = v_user
) then return v_inv.class_id;
end if;
if v_inv.revoked_at is not null then raise exception 'invitation revoked' using errcode = '22023';
end if;
if v_inv.expires_at <= now() then raise exception 'invitation expired' using errcode = '22023';
end if;
if v_inv.used_count >= v_inv.max_uses then raise exception 'invitation already fully used' using errcode = '22023';
end if;
select
  c.status into v_class_status
from
  public.classes c
where
  c.id = v_inv.class_id;
if v_class_status is distinct from 'active' then raise exception 'class is not active' using errcode = '22023';
end if;
if v_inv.email_restriction is not null then
select
  lower(u.email) into v_email
from
  auth.users u
where
  u.id = v_user;
if v_email is null
or v_email <> lower(v_inv.email_restriction) then raise exception 'invitation is restricted to another email address' using errcode = '42501';
end if;
end if;
insert into public.class_members (class_id, user_id, joined_via)
values (v_inv.class_id, v_user, 'invitation');
insert into public.class_invitation_acceptances (invitation_id, user_id)
values (v_inv.id, v_user);
update public.class_invitations
set
  used_count = used_count + 1
where
  id = v_inv.id;
perform public.record_audit(
  'class_invitation_accepted',
  'class_invitation',
  v_inv.id,
  v_inv.class_id,
  '{}'::jsonb
);
return v_inv.class_id;
end;
$$;


-- ---------------------------------------------------------------------------
-- Membership and admin assignment
-- ---------------------------------------------------------------------------
create or replace function public.assign_class_admin (p_class_id uuid, p_user_id uuid) returns boolean language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_actor uuid := (
    select
      auth.uid ()
  );
begin if not public.is_platform_admin () then raise exception 'platform admin required' using errcode = '42501';
end if;
if not exists (
  select
    1
  from
    public.classes c
  where
    c.id = p_class_id
) then raise exception 'class not found' using errcode = 'P0002';
end if;
insert into public.class_members (class_id, user_id, joined_via)
values (p_class_id, p_user_id, 'admin_assignment') on conflict (class_id, user_id) do nothing;
insert into public.class_admins (class_id, user_id, assigned_by)
values (p_class_id, p_user_id, v_actor) on conflict (class_id, user_id) do nothing;
perform public.record_audit(
  'class_admin_assigned',
  'class_admin',
  p_user_id,
  p_class_id,
  '{}'::jsonb
);
perform public.enqueue_notification_event(
  p_user_id,
  'class_admin_assigned',
  'class_admin:' || p_class_id || ':' || p_user_id || ':assigned',
  jsonb_build_object(
    'title',
    'You are now a class admin',
    'body',
    'You can review submissions for your class on StarsTask.',
    'url',
    '/dashboard'
  )
);
return true;
end;
$$;


create or replace function public.revoke_class_admin (p_class_id uuid, p_user_id uuid) returns boolean language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$ begin if not public.is_platform_admin () then raise exception 'platform admin required' using errcode = '42501';
end if;
if (
  select
    count(*)
  from
    public.class_admins ca
  where
    ca.class_id = p_class_id
) <= 1
and exists (
  select
    1
  from
    public.class_admins ca
  where
    ca.class_id = p_class_id
    and ca.user_id = p_user_id
) then raise exception 'class must keep at least one admin' using errcode = '22023';
end if;
delete from public.class_admins
where
  class_id = p_class_id
  and user_id = p_user_id;
if not found then raise exception 'class admin not found' using errcode = 'P0002';
end if;
perform public.record_audit(
  'class_admin_revoked',
  'class_admin',
  p_user_id,
  p_class_id,
  '{}'::jsonb
);
return true;
end;
$$;


create or replace function public.remove_class_member (p_class_id uuid, p_user_id uuid) returns boolean language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$ begin if not public.can_manage_class (p_class_id) then raise exception 'class admin required' using errcode = '42501';
end if;
if exists (
  select
    1
  from
    public.class_admins ca
  where
    ca.class_id = p_class_id
    and ca.user_id = p_user_id
)
and (
  select
    count(*)
  from
    public.class_admins ca
  where
    ca.class_id = p_class_id
) <= 1 then raise exception 'class must keep at least one admin' using errcode = '22023';
end if;
delete from public.class_members
where
  class_id = p_class_id
  and user_id = p_user_id;
if not found then raise exception 'member not found' using errcode = 'P0002';
end if;
perform public.record_audit(
  'class_member_removed',
  'class_member',
  p_user_id,
  p_class_id,
  '{}'::jsonb
);
return true;
end;
$$;


create or replace function public.set_class_status (p_class_id uuid, p_status text) returns boolean language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$ begin if not public.is_platform_admin () then raise exception 'platform admin required' using errcode = '42501';
end if;
if p_status not in ('active', 'archived') then raise exception 'invalid class status' using errcode = '22023';
end if;
update public.classes
set
  status = p_status
where
  id = p_class_id;
if not found then raise exception 'class not found' using errcode = 'P0002';
end if;
perform public.record_audit(
  case
    when p_status = 'archived' then 'class_archived'
    else 'class_restored'
  end,
  'class',
  p_class_id,
  p_class_id,
  '{}'::jsonb
);
return true;
end;
$$;


create or replace function public.update_class_metadata (
  p_class_id uuid,
  p_name text,
  p_description text,
  p_course_name text,
  p_semester text,
  p_academic_year text,
  p_institution text DEFAULT NULL,
  p_lecturer_name text DEFAULT NULL
) returns boolean language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_course_id uuid;
begin if not public.can_manage_class (p_class_id) then raise exception 'class admin required' using errcode = '42501';
end if;
insert into public.courses (name)
values (btrim(p_course_name)) on conflict (normalized_name) do
update
set
  name = excluded.name returning id into v_course_id;
update public.classes
set
  name = btrim(p_name),
  description = btrim(p_description),
  course_id = v_course_id,
  course_name = btrim(p_course_name),
  institution = nullif(btrim(coalesce(p_institution, '')), ''),
  lecturer_name = nullif(btrim(coalesce(p_lecturer_name, '')), ''),
  semester = btrim(p_semester),
  academic_year = btrim(p_academic_year)
where
  id = p_class_id;
if not found then raise exception 'class not found' using errcode = 'P0002';
end if;
perform public.record_audit(
  'class_updated',
  'class',
  p_class_id,
  p_class_id,
  '{}'::jsonb
);
return true;
end;
$$;


-- ---------------------------------------------------------------------------
-- Assignment submission and review
-- ---------------------------------------------------------------------------
create or replace function public.submit_class_assignment (
  p_class_id uuid,
  p_title text,
  p_description text,
  p_deadline timestamptz DEFAULT NULL,
  p_assignment_type text DEFAULT NULL,
  p_tags TEXT[] DEFAULT '{}',
  p_reference_urls jsonb DEFAULT '[]'::jsonb
) returns uuid language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_user uuid := (
    select
      auth.uid ()
  );
  v_class public.classes;
  v_id uuid;
begin if v_user is null then raise exception 'authentication required' using errcode = '42501';
end if;
select
  * into v_class
from
  public.classes
where
  id = p_class_id;
if not found then raise exception 'class not found' using errcode = 'P0002';
end if;
if v_class.status <> 'active' then raise exception 'class is not accepting submissions' using errcode = '22023';
end if;
if not public.is_class_member (p_class_id) then raise exception 'class membership required' using errcode = '42501';
end if;
insert into public.assignments (
  title,
  description,
  course_id,
  user_id,
  class_id,
  lecturer_name,
  semester,
  academic_year,
  assignment_type,
  deadline,
  tags,
  reference_urls,
  status
)
values (
  btrim(p_title),
  btrim(p_description),
  v_class.course_id,
  v_user,
  p_class_id,
  v_class.lecturer_name,
  v_class.semester,
  v_class.academic_year,
  p_assignment_type,
  p_deadline,
  coalesce(p_tags, '{}'),
  coalesce(p_reference_urls, '[]'::jsonb),
  'pending_review'
)
returning
  id into v_id;
insert into public.assignment_reviews (assignment_id, reviewer_id, decision)
values (v_id, v_user, 'submitted');
perform public.record_audit(
  'assignment_submitted',
  'assignment',
  v_id,
  p_class_id,
  '{}'::jsonb
);
-- Every class admin hears about the new submission, except the submitter when
-- that person is also an admin.
perform public.enqueue_notification_event(
  ca.user_id,
  'submission_received',
  'submission:' || v_id || ':' || ca.user_id,
  jsonb_build_object(
    'title',
    'New submission to review',
    'body',
    'A class member submitted an assignment for review.',
    'url',
    '/dashboard/review'
  )
)
from
  public.class_admins ca
where
  ca.class_id = p_class_id
  and ca.user_id <> v_user;
return v_id;
end;
$$;


create or replace function public.revise_class_assignment (
  p_assignment_id uuid,
  p_title text,
  p_description text,
  p_deadline timestamptz DEFAULT NULL,
  p_assignment_type text DEFAULT NULL,
  p_tags TEXT[] DEFAULT '{}',
  p_reference_urls jsonb DEFAULT '[]'::jsonb
) returns boolean language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_user uuid := (
    select
      auth.uid ()
  );
  v_assignment public.assignments;
begin if v_user is null then raise exception 'authentication required' using errcode = '42501';
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
if v_assignment.user_id <> v_user then raise exception 'not your submission' using errcode = '42501';
end if;
if v_assignment.status not in ('rejected', 'draft') then raise exception 'submission is not editable' using errcode = '22023';
end if;
update public.assignments
set
  title = btrim(p_title),
  description = btrim(p_description),
  deadline = p_deadline,
  assignment_type = p_assignment_type,
  tags = coalesce(p_tags, '{}'),
  reference_urls = coalesce(p_reference_urls, '[]'::jsonb),
  status = 'pending_review',
  rejection_reason = null,
  reviewed_by = null,
  reviewed_at = null,
  revision = revision + 1
where
  id = p_assignment_id;
insert into public.assignment_reviews (assignment_id, reviewer_id, decision)
values (p_assignment_id, v_user, 'submitted');
perform public.record_audit(
  'assignment_resubmitted',
  'assignment',
  p_assignment_id,
  v_assignment.class_id,
  jsonb_build_object('revision', v_assignment.revision + 1)
);
return true;
end;
$$;


create or replace function public.review_class_assignment (
  p_assignment_id uuid,
  p_decision text,
  p_reason text DEFAULT NULL
) returns text language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_reviewer uuid := (
    select
      auth.uid ()
  );
  v_assignment public.assignments;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_status text;
begin if v_reviewer is null then raise exception 'authentication required' using errcode = '42501';
end if;
if p_decision not in ('approved', 'rejected') then raise exception 'invalid decision' using errcode = '22023';
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
if v_assignment.class_id is null then raise exception 'assignment does not belong to a class' using errcode = '22023';
end if;
if not public.can_manage_class (v_assignment.class_id) then raise exception 'class admin required' using errcode = '42501';
end if;
-- Reviewing your own submission defeats the point of review.
if v_assignment.user_id = v_reviewer then raise exception 'you cannot review your own submission' using errcode = '42501';
end if;
if v_assignment.status not in ('pending_review', 'rejected') then raise exception 'submission is not awaiting review' using errcode = '22023';
end if;
if p_decision = 'rejected' then if v_reason is null
or char_length(v_reason) < 3 then raise exception 'rejection reason required' using errcode = '22023';
end if;
v_status := 'rejected';
else v_status := 'published';
end if;
update public.assignments
set
  status = v_status,
  reviewed_by = v_reviewer,
  reviewed_at = now(),
  rejection_reason = case
    when v_status = 'rejected' then v_reason
    else null
  end,
  published_at = case
    when v_status = 'published' then now()
    else published_at
  end
where
  id = p_assignment_id;
insert into public.assignment_reviews (assignment_id, reviewer_id, decision, reason)
values (p_assignment_id, v_reviewer, p_decision, v_reason);
perform public.record_audit(
  case
    when v_status = 'published' then 'assignment_approved'
    else 'assignment_rejected'
  end,
  'assignment',
  p_assignment_id,
  v_assignment.class_id,
  '{}'::jsonb
);
perform public.enqueue_notification_event(
  v_assignment.user_id,
  case
    when v_status = 'published' then 'assignment_approved'
    else 'assignment_rejected'
  end,
  'assignment_review:' || p_assignment_id || ':' || v_status || ':' || v_assignment.revision,
  case
    when v_status = 'published' then jsonb_build_object(
      'title',
      'Assignment approved',
      'body',
      'Your assignment is now public on StarsTask.',
      'url',
      '/assignments/' || p_assignment_id
    )
    else jsonb_build_object(
      'title',
      'Assignment rejected',
      'body',
      'Open StarsTask to read the reviewer note and resubmit.',
      'url',
      '/my-assignments'
    )
  end
);
return v_status;
end;
$$;


-- ---------------------------------------------------------------------------
-- Post-publication moderation
-- ---------------------------------------------------------------------------
create or replace function public.moderate_assignment (
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
if v_assignment.class_id is not null then if not public.can_manage_class (v_assignment.class_id) then raise exception 'class admin or platform admin required' using errcode = '42501';
end if;
elsif not public.is_platform_admin () then raise exception 'platform admin required' using errcode = '42501';
end if;
if p_action = 'restore' then if v_assignment.status not in ('unpublished', 'archived') then raise exception 'only unpublished or archived assignments can be restored' using errcode = '22023';
end if;
v_status := 'published';
else if v_reason is null
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


-- Returns the storage path so the caller can delete the object with the service
-- role. Removing the row first means the file is unreachable even if the
-- storage delete fails and needs a retry.
create or replace function public.remove_assignment_attachment (
  p_attachment_id uuid,
  p_reason text DEFAULT NULL
) returns text language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_path text;
  v_assignment_id uuid;
  v_class_id uuid;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin if (
  select
    auth.uid ()
) is null then raise exception 'authentication required' using errcode = '42501';
end if;
select
  aa.storage_path,
  aa.assignment_id,
  a.class_id into v_path,
  v_assignment_id,
  v_class_id
from
  public.assignment_attachments aa
  join public.assignments a on a.id = aa.assignment_id
where
  aa.id = p_attachment_id;
if v_path is null then raise exception 'attachment not found' using errcode = 'P0002';
end if;
if v_class_id is null then if not public.is_platform_admin () then raise exception 'platform admin required' using errcode = '42501';
end if;
elsif not public.can_manage_class (v_class_id) then raise exception 'class admin or platform admin required' using errcode = '42501';
end if;
if v_reason is null
or char_length(v_reason) < 3 then raise exception 'removal reason required' using errcode = '22023';
end if;
delete from public.assignment_attachments
where
  id = p_attachment_id;
perform public.record_audit(
  'assignment_attachment_removed',
  'assignment_attachment',
  p_attachment_id,
  v_class_id,
  jsonb_build_object('assignment_id', v_assignment_id)
);
return v_path;
end;
$$;


-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------
revoke all on function public.record_audit (text, text, uuid, uuid, jsonb)
from
  public,
  anon,
  authenticated;


revoke all on function public.enqueue_notification_event (uuid, text, text, jsonb)
from
  public,
  anon,
  authenticated;


revoke all on function public.is_platform_admin ()
from
  public;


revoke all on function public.is_class_member (uuid)
from
  public;


revoke all on function public.is_class_admin (uuid)
from
  public;


revoke all on function public.can_manage_class (uuid)
from
  public;


grant
execute on function public.is_platform_admin () to authenticated;


grant
execute on function public.is_class_member (uuid) to authenticated;


grant
execute on function public.is_class_admin (uuid) to authenticated;


grant
execute on function public.can_manage_class (uuid) to authenticated;


revoke all on function public.apply_for_class (text, text, text, text, text, text, text, text, text, text)
from
  public;


grant
execute on function public.apply_for_class (text, text, text, text, text, text, text, text, text, text) to authenticated;


revoke all on function public.revise_class_application (uuid, text, text, text, text, text, text, text, text, text, text)
from
  public;


grant
execute on function public.revise_class_application (uuid, text, text, text, text, text, text, text, text, text, text) to authenticated;


revoke all on function public.withdraw_class_application (uuid)
from
  public;


grant
execute on function public.withdraw_class_application (uuid) to authenticated;


revoke all on function public.decide_class_application (uuid, text, text, boolean)
from
  public,
  anon,
  authenticated;


grant
execute on function public.decide_class_application (uuid, text, text, boolean) to authenticated;


revoke all on function public.create_class_invitation (uuid, text, timestamptz, integer, text)
from
  public;


grant
execute on function public.create_class_invitation (uuid, text, timestamptz, integer, text) to authenticated;


revoke all on function public.revoke_class_invitation (uuid)
from
  public;


grant
execute on function public.revoke_class_invitation (uuid) to authenticated;


revoke all on function public.accept_class_invitation (text)
from
  public;


grant
execute on function public.accept_class_invitation (text) to authenticated;


revoke all on function public.assign_class_admin (uuid, uuid)
from
  public;


grant
execute on function public.assign_class_admin (uuid, uuid) to authenticated;


revoke all on function public.revoke_class_admin (uuid, uuid)
from
  public;


grant
execute on function public.revoke_class_admin (uuid, uuid) to authenticated;


revoke all on function public.remove_class_member (uuid, uuid)
from
  public;


grant
execute on function public.remove_class_member (uuid, uuid) to authenticated;


revoke all on function public.set_class_status (uuid, text)
from
  public;


grant
execute on function public.set_class_status (uuid, text) to authenticated;


revoke all on function public.submit_class_assignment (uuid, text, text, timestamptz, text, TEXT[], jsonb)
from
  public;


grant
execute on function public.submit_class_assignment (uuid, text, text, timestamptz, text, TEXT[], jsonb) to authenticated;


revoke all on function public.revise_class_assignment (uuid, text, text, timestamptz, text, TEXT[], jsonb)
from
  public;


grant
execute on function public.revise_class_assignment (uuid, text, text, timestamptz, text, TEXT[], jsonb) to authenticated;


revoke all on function public.review_class_assignment (uuid, text, text)
from
  public;


grant
execute on function public.review_class_assignment (uuid, text, text) to authenticated;


revoke all on function public.moderate_assignment (uuid, text, text)
from
  public;


grant
execute on function public.moderate_assignment (uuid, text, text) to authenticated;


revoke all on function public.remove_assignment_attachment (uuid, text)
from
  public;


grant
execute on function public.remove_assignment_attachment (uuid, text) to authenticated;


revoke all on function public.update_class_metadata (uuid, text, text, text, text, text, text, text)
from
  public;


grant
execute on function public.update_class_metadata (uuid, text, text, text, text, text, text, text) to authenticated;
