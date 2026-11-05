# 21 — Domain O: Social / Announcements / Discussions

> **Status:** DRAFT. **CONFIRMED** = announcements separate formal channel; social = candidate only; discussions maybe separate. Schemas below are **PROPOSED** (not APPROVED).

## 21.1 Separation rule (CONFIRMED)

- **Announcements** = formal channel (class/offering-scoped, class-admin-published, member-read, push fan-out).
- **Social feed** (X/Threads-inspired) = **candidate features only** — excluded from mandatory target schema until product confirms (ADR-016 APPROVED).
- **Discussions** = maybe separate domain (UNRESOLVED whether threads are a new table or reuse `discussion_sessions`).

## 21.2 Existing evidence (VERIFIED-ish)

- Class posts: migration `20261029003800_class_posts_and_delete.sql` (VERIFIED present; exact shape UNRESOLVED — whether posts live in a dedicated table or on `classes`/`class_calendar_events` needs a Phase 5A read).
- `discussion_sessions` + RSVPs/reminders/checkins (VERIFIED tables) cover face-to-face session discussions, not topic threads.
- No feed tables (posts/likes/follows) were evidenced — social remains candidate-only.

## 21.3 Visibility scopes (RECOMMENDED)

| Channel                 | Who can publish                                      | Who can read                                          | Notifications                                  |
| ----------------------- | ---------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------- |
| Announcements           | class admins (`manage_announcements`)                | class members (+ enrolled retake students, read-only) | Web push (VERIFIED push infra)                 |
| Discussions (if built)  | members                                              | members                                               | In-app inbox                                   |
| Social feed (candidate) | per product                                          | TBD (likely global/class)                             | TBD                                            |
| Sessions (existing)     | organizers (`can_organize_class_sessions`, VERIFIED) | members                                               | Reminders (VERIFIED `claim_session_reminders`) |

## 21.4 Candidate schemas (ALL PROPOSED — illustrative only, not in `26` mandatory specs)

```sql
-- PROPOSED announcements (target — see 26 for normative spec)
CREATE TABLE announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  university_id uuid NOT NULL,
  class_id uuid NOT NULL,
  offering_id uuid,
  author uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  archived_at timestamptz
);

-- PROPOSED discussion threads (only if product approves; otherwise fold into discussion_sessions)
CREATE TABLE discussion_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  university_id uuid NOT NULL,
  offering_id uuid NOT NULL,
  author uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'open'
);

-- PROPOSED social feed (CANDIDATE — excluded from migration planning until confirmed)
-- posts / follows / likes / reposts — do not spec further.
```

## 21.5 Why separation matters (CONFIRMED)

- Announcements need guarantees (admin author, pinned, archived, audit) that a feed does not; fan-out differs (push vs inbox); deleting a feed post must not delete an announcement.
- Do not reuse `notification_events` rows as content — they are the outbox (see `22`), not user-authored content.

**Cross-refs:** `06`, `12`, `13`, `15` (manage_announcements), `22` (fan-out), `26` §26.1 (announcements only), ADR-012/016, `36` item 3.
