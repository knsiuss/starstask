# 5I-H — Announcements & Notifications

**Status: COMPLETE** (class-scoped announcements with manager/member views; notifications reuse the existing outbox — no duplicates)

## Announcements (new domain, `20261116000000_communication.sql`)

| File                                                                  | Role                                                                                                |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `apps/web/src/lib/db/announcements.ts`                                | Published (RLS) + full (service, manager) lists; create/update with audit; `recordAnnouncementRead` |
| `apps/web/src/app/api/classes/[slug]/academic/announcements/route.ts` | `POST` create — `manage_announcements`                                                              |
| `.../announcements/[announcementId]/route.ts`                         | `PATCH` title/body/pin/publish/archive — `manage_announcements`                                     |
| `.../announcements/[announcementId]/read/route.ts`                    | `POST` mark-read — RLS visibility check, then idempotent service-role upsert                        |
| `academic/announcements/page.tsx`                                     | Manager view (all rows, composer, actions) / member view (published only, mark-as-read)             |

Behavior contract:

- **Members** see published, non-archived announcements only; the member query filters `published_at IS NOT NULL` and `archived_at IS NULL` (RLS alone would also expose drafts — the app must not, and does not).
- **Managers** (manage_announcements or platform admin) see everything incl. drafts/archived; pin toggle, publish draft, archive; edits audit-logged (`announcement_created` / `announcement_updated`).
- **Read markers:** `announcement_reads` is idempotent per (announcement, user); written via service path only after the RLS-visible check passes; unread state renders as "Mark as read" vs "Read".
- **Scoping:** `class_id` (+ optional `offering_id` validated to belong to the class and university). Cross-class rows are indistinguishable from missing (404/`not_found`).
- `is_class_member` vs `manage_announcements`: members ≥ read published; managers ≥ everything else. Legacy `class_announcement` assignment flow is a **separate** legacy surface and was not modified.

## Notifications (existing outbox — reused, not duplicated)

- `lib/db/notifications.ts` inbox: paginated list, `unreadOnly` filter, `unreadCount`, `markNotificationsRead` → `mark_notification_events_read` RPC, `href` sanitised via `isSafeNotificationPath`, per-row `kind` → icons/labels.
- `(workspace)/notifications` page + dashboard rail + topbar bell already consume it; **5I changed nothing** — no duplicate pipeline, no new event kinds, `notification_events.university_id` remains unused.
- Announcements deliberately do **not** emit outbox events (no product decision on fan-out; would duplicate legacy class-post notifications). Announcement read markers are independent of the outbox.

## Explicitly out of scope / not implemented

- **Chat: NOT IMPLEMENTED.** No DMs, groups, messages, receipts, or moderation anywhere; announcements are not a chat and don't grow into one.
- **Discussions (`discussion_threads`): isolated**, class/offering scope unresolved (#3). No wiring; table untouched; never shown in UI.
- **Social/feed placeholders:** none touched; no replacement anywhere.
- Notification fan-out for new announcements: blocked on product decision (would risk duplicate delivery).

## Validation

Schema bounds mirrored in Zod (title 3–200, body 1–20000 — DB CHECKs match). Read-marker idempotency enforced by `announcement_reads_unique`. Tenant re-validation on every write (class id + university id match). Cross-class reads return 404.
