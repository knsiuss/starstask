-- Realtime: publish DM tables so postgres_changes actually fires.
-- Without this, browser subscriptions in dm-realtime.ts never receive
-- INSERT/UPDATE events and new messages only appear after a reload.
-- Ciphertext only ever flows through realtime; clients refetch + decrypt.
-- RLS still applies to realtime payloads: participants only (see
-- 20261135000000_direct_messages.sql, 20261143000000_dm_v2.sql).
-- Run manually in Supabase (supabase db push / SQL editor).
--
-- Rollback: ALTER PUBLICATION supabase_realtime DROP TABLE
-- public.dm_messages, public.dm_typing;
ALTER PUBLICATION supabase_realtime
ADD TABLE public.dm_messages,
public.dm_typing;


ALTER TABLE public.dm_messages REPLICA IDENTITY FULL;
