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
  write objects for a University A class. Verified via policy text —
  no live cross-tenant upload test (would require a storage upload,
  not run in this phase; tracked as follow-up).
- `assignment-attachments` / `leave-evidence` / `verification-evidence`
  reads are owner-or-authorized-reviewer only; writes are owner-scoped.
- No storage policy uses a bare `authenticated` check without
  bucket + ownership / class-admin predicates.

## Classification
- `class-media` / `avatars` public read: INFORMATIONAL (by design).
- File-ownership / tenant association by class path: verified at
  policy level; live upload-overwrite-delete tests remain a
  follow-up (require storage API + seed objects).
