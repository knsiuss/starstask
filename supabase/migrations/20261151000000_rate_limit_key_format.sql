-- QA-08: consume_rate_limit only accepts server-derived key material.
-- The application always hashes (action, identifier) with a server salt into
-- a 40-char hex digest before calling this function, so ANY other key format
-- is either a caller mistake or an attempt to exhaust another bucket.
-- Anon keeps EXECUTE for pre-auth endpoints (which still use hashed keys).
-- Body otherwise unchanged from 20261029000200.
CREATE OR REPLACE FUNCTION public.consume_rate_limit (p_key text, p_limit integer, p_window_seconds integer) returns boolean language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare v_now timestamptz := now();
v_hits integer;
begin if p_key is null
or p_key !~ '^[0-9a-f]{40}$' then raise exception 'invalid rate limit key' using errcode = '22023';
end if;
if p_limit < 1
or p_limit > 10000
or p_window_seconds < 1
or p_window_seconds > 86400 then raise exception 'invalid rate limit configuration' using errcode = '22023';
end if;
insert into public.rate_limits (key, window_started_at, hits)
values (p_key, v_now, 1) on conflict (key) do
update
set hits = case
    when public.rate_limits.window_started_at <= v_now - make_interval(secs => p_window_seconds) then 1
    else public.rate_limits.hits + 1
  end,
  window_started_at = case
    when public.rate_limits.window_started_at <= v_now - make_interval(secs => p_window_seconds) then v_now
    else public.rate_limits.window_started_at
  end
returning hits into v_hits;
-- Cheap opportunistic cleanup; no cron job required for a small deployment.
if random() < 0.01 then
delete from public.rate_limits
where window_started_at < v_now - interval '1 day';
end if;
return v_hits <= p_limit;
end;
$$;
