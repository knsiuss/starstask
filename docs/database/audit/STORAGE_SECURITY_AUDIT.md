# Storage Security Audit — 5 buckets (Phase 3)

Evidence: `SELECT bucket_id, count(*) FROM storage.objects GROUP BY bucket_id`, `storage.buckets` counts (5 buckets, 2 public), 18 storage policies verbatim (`pg_policies WHERE schemaname='storage'`).

## Bucket inventory

| Bucket                   | Public?    | Objects | Content (from code/seed)                                     | Verdict                                                                                      |
| ------------------------ | ---------- | ------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `assignment-attachments` | private    | 2       | Student assignment files.                                    | OK — owner + `published` + reviewer read rules.                                              |
| `avatars`                | public     | 3       | Profile avatars.                                             | OK — anyone can read avatar; acceptable public identity.                                     |
| `class-media`            | **public** | **0**   | Class avatar/cover (`set_class_media` RPC writes URLs here). | **P1 — see below.**                                                                          |
| `leave-evidence`         | private    | 6       | Absence supporting docs.                                     | OK — owner + leave-request-owner checks on write; read via `can_review_leave_request`.       |
| `verification-evidence`  | private    | 0       | Class verification documents.                                | OK — owner + `can_edit_class_verification` on write; read via `can_view_class_verification`. |

Total objects: 11. No bucket visibility or file was changed in this phase.

## `class-media` investigation (required)

- Bucket flag: `public=true`.
- Storage policy `class_media_storage_read`: `SELECT {anon,authenticated} WHERE bucket_id='class-media'` — **no object-level restriction**. Any anon user can read any object ever placed in this bucket.
- Write policies (`class_media_storage_write/update/delete`): gated to `class_admins` of the folder's `class_id` — correct.
- Current object count: **0**. So **no data is exposed today**.
- Product content: avatar/cover images only (per `set_class_media`). If that stays true (logos/covers), public read is contextually defensible — but the policy does not enforce "logo only". If a class ever uploads a group photo (student faces) expecting member-only access, expectation will be silently violated.
- **P1 recommendation (not implemented):** keep bucket public only if avatars/covers are confirmed product requirement; otherwise flip to private and serve via signed URLs. Owner decision required; do not flip silently.

## Other storage notes

- All private buckets enforce `storage.foldername(name)[1] = auth.uid()` on write — users cannot write into each other's folders.
- `assignment-attachments` write also requires owning the assignment (`assignment_id_from_object_path`); read allows owner, published readers, and class admin/platform admin review path.
- `leave-evidence` insert additionally requires `is_leave_request_owner(leave_request_id_from_object_path(name))` — good binding.
- Sign-off status: **INCOMPLETE** — bucket policies verified (18/18 verbatim), but object-level content review (do the 2 attachment / 6 evidence files contain PII?) was not performed (would require object reads). Flagged for Phase 4 with owner authorization.

## Tenant implications

Folder scheme is `uid/...` or `class_id/...`. With no tenant, `class_id` folder is the isolation unit. Multi-tenant design must prefix `university_id` (or accept global class ids — collision-safe as UUIDs but leaks cross-university readability via the public `class-media` read rule).
