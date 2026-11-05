# Phase 5L — Storage Security

Buckets (verified live): `assignment-attachments` (private),
`leave-evidence` (private), `verification-evidence` (private),
`avatars` (public), `class-media` (public).

## Findings
- No change made. `avatars` and `class-media` public reads are
  intentional: class identity / avatar images are shown on pages
  any reader can open (`class-media` header in `20261102100000`).
- `class-media` writes (INSERT/UPDATE/DELETE) are scoped to
  `class_admins` for the class in the object path
  (`foldername(name)[1] = class_id`), so a University B admin cannot
  write objects for a University A class. Verified live 2026-11-05
  via `supabase/tests/phase5l-storage-policy-validation.sql`
  (S1–S4 PASS): public read allowed, anon/non-admin INSERT denied by RLS.
  NOTE: direct SQL DELETE on `storage.objects` is blocked by the
  Storage hook for every role ("Use the Storage API instead") — API
  DELETE still goes through the class-admin policy; that live API-level
  DELETE remains a follow-up.
- `assignment-attachments` / `leave-evidence` / `verification-evidence`
  reads are owner-or-authorized-reviewer only; writes are owner-scoped.
- No storage policy uses a bare `authenticated` check without
  bucket + ownership / class-admin predicates.

## Classification
- `class-media` / `avatars` public read: INFORMATIONAL (by design).
- File-ownership / tenant association by class path: verified live
  (S1–S4 PASS, 2026-11-05); Storage API DELETE / UPDATE overwrite
  remains a follow-up (requires HTTP upload + seeded objects).
