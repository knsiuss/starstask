# Phase 5F — Implementation

Migration: `supabase/migrations/20261116000000_communication.sql`. New: announcements, announcement_reads, discussion_threads (comment: ISOLATED PROPOSAL). Evolved: notification_events/deliveries (+university_id). RLS: announcements/read owner/member per class; discussion_threads SELECT only.
