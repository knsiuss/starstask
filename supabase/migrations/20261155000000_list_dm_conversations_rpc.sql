-- Single-roundtrip conversation list for the Messages page.
--
-- Replaces the 4 sequential PostgREST reads (my participants -> all
-- participants -> all messages -> profiles) with one RPC. Rows are shaped
-- to match ConversationRow in lib/db/direct-messages.ts; the caller maps
-- snake_case columns to camelCase. No message content is returned: the
-- preview is a fixed marker because the server cannot decrypt.
create or replace function public.list_dm_conversations()
returns table (
  id uuid,
  other_user_id uuid,
  other_name text,
  other_avatar_url text,
  is_group boolean,
  participant_names text[],
  last_message text,
  last_at timestamptz,
  unread boolean,
  unread_count integer,
  is_pinned boolean,
  is_muted boolean,
  is_archived boolean
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  return query
  with my_parts as (
    select conversation_id, last_read_at, is_pinned, is_muted, is_archived, pinned_at
    from dm_participants
    where user_id = me and left_at is null
  ),
  others as (
    select
      p.conversation_id,
      p.user_id as other_id,
      pr.display_name as other_display,
      pr.avatar_url as other_avatar
    from dm_participants p
    left join profiles pr on pr.id = p.user_id
    where p.conversation_id in (select conversation_id from my_parts)
      and p.user_id <> me
  )
  select
    mp.conversation_id as id,
    coalesce(o.other_id, me) as other_user_id,
    case
      when (select count(*) from others o2 where o2.conversation_id = mp.conversation_id) > 1
        then (select count(*) from others o2 where o2.conversation_id = mp.conversation_id)::text || ' members'
      else coalesce(
        (select other_display from others o2 where o2.conversation_id = mp.conversation_id limit 1),
        'User'
      )
    end as other_name,
    (select other_avatar from others o2 where o2.conversation_id = mp.conversation_id limit 1) as other_avatar_url,
    (select count(*) from others o2 where o2.conversation_id = mp.conversation_id) > 1 as is_group,
    coalesce((
      select array_agg(coalesce(other_display, 'User') order by other_display)
      from others o2 where o2.conversation_id = mp.conversation_id
    ), '{}') as participant_names,
    case when exists (
      select 1 from dm_messages m
      where m.conversation_id = mp.conversation_id and m.deleted_at is null
    ) then '🔒 Encrypted' end as last_message,
    (select max(m.created_at) from dm_messages m
      where m.conversation_id = mp.conversation_id and m.deleted_at is null) as last_at,
    coalesce((
      select count(*) from dm_messages m
      where m.conversation_id = mp.conversation_id
        and m.deleted_at is null
        and m.sender_id <> me
        and (mp.last_read_at is null or m.created_at > mp.last_read_at)
    ), 0) > 0 as unread,
    coalesce((
      select count(*) from dm_messages m
      where m.conversation_id = mp.conversation_id
        and m.deleted_at is null
        and m.sender_id <> me
        and (mp.last_read_at is null or m.created_at > mp.last_read_at)
    ), 0)::integer as unread_count,
    coalesce(mp.is_pinned, false) as is_pinned,
    coalesce(mp.is_muted, false) as is_muted,
    coalesce(mp.is_archived, false) as is_archived
  from my_parts mp
  order by
    coalesce(mp.is_archived, false) asc,
    coalesce(mp.is_pinned, false) desc,
    mp.pinned_at desc nulls last,
    (select max(m.created_at) from dm_messages m
      where m.conversation_id = mp.conversation_id and m.deleted_at is null) desc nulls last,
    mp.conversation_id desc;
end;
$$;

revoke execute on function public.list_dm_conversations() from anon;
grant execute on function public.list_dm_conversations() to authenticated;
