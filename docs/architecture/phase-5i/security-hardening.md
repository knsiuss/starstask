# 5I-J — Security Hardening

**Status: PARTIALLY** (design + unit-level negative paths shipped; live RLS/staging negative tests pending activation)

## Server-side authorization inventory (all new surfaces)

| Surface                          | Gate                                       | Notes                                     |
| -------------------------------- | ------------------------------------------ | ----------------------------------------- |
| `/university`                    | session (any state shown honestly)         | no writes at all                          |
| Hub `/academic`                  | legacy manage **or** any new permission    | else 404                                  |
| `/academic/admins`               | `manage_admins`                            | pages + POST/DELETE                       |
| `/academic/attendance`           | `manage_attendance`                        | pages + POST meetings/records/corrections |
| `/academic/announcements`        | member read / `manage_announcements` write | PATCH + POST + read-marker                |
| `/academic/grades`               | `manage_grades`                            | read-only                                 |
| `/academic/schedule`             | class member                               | read-only                                 |
| `/admin/invitations`             | platform admin (`requirePlatformAdmin`)    | list + revoke                             |
| `POST /api/admin/academic-years` | platform admin                             | create                                    |

## Invariants enforced

- **No server truth from the client:** all mutations take only ids + payloads from the body; tenant keys come from the loaded class/offering row, never the request.
- **service_role** is confined to `lib/authz/service-role.ts`, imported only by route handlers **after** `requireClassPermission`/`requirePlatformAdmin` passes; it is never bundled to the client (the module throws 503 when unconfigured).
- **Fail closed:** `hasClassPermission` throws on RPC error rather than returning false-quietly; page guards return `not_found`/`forbidden` without leaking existence.
- **Tenant re-validation:** meeting→offering→class→university chain and announcement→class→university are verified inside every service-role write. Composite FKs (`*_same_university`) are the second line of defense; violations map to 422/`invalid_*`.
- **Zod at every edge** (`@starstask/contracts`); bounds match DB CHECKs.
- **RLS untouched** — no policy, grant, or function changed. `has_class_permission` granted to authenticated; `is_university_member` likewise; nothing else widened.
- **Tenant-unlinked legacy classes** get the standard notice; new-model reads/writes are impossible against them (offerings can't exist: composite FK would reject).
- **Secrets:** `SUPABASE_SERVICE_ROLE_KEY` never appears in client code or logs; no new env vars introduced.
- **Rate limits:** all new POST/DELETE routes call `enforceRateLimit` (30–240/hour by sensitivity).
- **Audit:** admin grants/revokes, meeting creation, roster upserts, corrections, announcement create/update, invite revocation, academic-year creation → `audit_logs` with `university_id`.

## Negative test coverage (unit level)

| Path                                                                                                             | Test                                                                                              |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Identity decision matrix (no profile, no/one/many memberships, suspended, inactive university, missing identity) | `tests/unit/identity-context.test.ts`                                                             |
| Zod rejection of oversized/invalid payloads (incl. `not_applicable` status)                                      | `tests/unit/academic-schemas.test.ts`                                                             |
| Tenant-unlinked → 409/404 mapping                                                                                | implemented in routes; **not executed against a live DB this phase**                              |
| Anonymous / cross-university / wrong-class denials                                                               | covered by design via RLS + gates; **no live negative tests run** (see test-validation-report.md) |

## Accepted residual risks

- **Local schema parity NOT VERIFIED** (no DB started); behavior claims derive from migration source review only.
- service_role paths cannot be transactional across PostgREST calls; audit failure aborts with 500 and says the mutation may have applied (documented in `lib/db/audit.ts`).
- `attendance_records` upsert uses last-write-wins; concurrent managers can overwrite statuses (ledger only captures corrections, not upserts — noted for 5J review).
- `announcement_reads` insert race resolved by unique index + `ignoreDuplicates`.
- Audit rows lack `before/after` payloads for roster upserts (by design; ledger captures changes).

## Recommendation for 5J

Stand up a disposable staging DB, seed synthetic university A/B with linked classes, and replay the negative matrix live (anonymous, cross-university read/write, wrong-class admin, revoked token, last-admin). Then regenerate `types/database.generated.ts` in CI and delete the handwritten drift permanently.
