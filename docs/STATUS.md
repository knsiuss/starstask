# StarsTask status — 2026-11-02

This page tracks the product roadmap against what is actually in the
repository. It distinguishes **implemented and checked locally** from
**verified in production**. A feature is not "live" until the production
steps in this file are completed.

Legend: **Done** (code in place, checks pass), **Partial** (part of the
capability exists), **Pending** (not built), **Blocked** (needs the owner's
authorization or external setup).

## Phase A — trustworthy foundation

| Item                          | Status  | Evidence / remaining work                                                                                           |
| ----------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| Migrations on real Postgres   | Done    | Applied to the live project on 2026-11-02 with owner approval; `supabase migration list --linked` now matches local |
| CI with integration tests     | Done    | `.github/workflows/ci.yml` runs lint, type-check, unit tests, migration verification, and the opt-in suite          |
| Staging deploy                | Blocked | No staging project or credentials in this workspace; steps are in `DEPLOYMENT.md`                                   |
| Google OAuth                  | Done    | Supabase-hosted Google sign-in with a validated `next` return path                                                  |
| Real push and cron            | Partial | Scheduler, push, and cron routes are implemented; a delivery on a physical device is still unobserved               |
| Rate limiter                  | Done    | Redis → Postgres → in-process fallback; see `SECURITY.md`                                                           |
| CSP nonce                     | Done    | Per-response nonce; verified in unit tests and the production build                                                 |
| Retention policy              | Done    | Check-in coordinates, reminder ledger (180-day default), and evidence/orphan rules documented in `DATABASE.md`      |
| Privacy and Terms             | Done    | `/privacy` and `/terms`, linked from the footer                                                                     |
| Error monitoring              | Done    | `/developer/*` logs, health, database, integration, and incident views; no third-party error service                |
| Feature flags per module      | Done    | `NEXT_PUBLIC_FEATURE_OCR`, `_CALENDAR_SYNC`, `_SESSION_CHECKIN`; default on, disabled modules return 404            |
| Aggregate metrics without PII | Done    | `developer_class_metrics` and `/developer/classes` return counts only                                               |

**Exit gate:** not met in production. A real push delivery and green CI on the
owner's remote are still required. Live migrations and the Privacy/Terms pages
are in place.

## Phase B — one-class habit

| Item                             | Status  | Notes                                                                                                              |
| -------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------ |
| Onboarding under 2 minutes       | Partial | Invitation → Google → join exists; measured completion has not been run                                            |
| In-app inbox                     | Done    | `/notifications` with read state and unread badge                                                                  |
| Weekly email digest              | Pending | No mail provider is configured; delivery must not ship without an owner decision on the provider                   |
| Class-leader action center       | Done    | `/dashboard/actions` totals pending submissions, absences, today's sessions, and open reader reports per led class |
| WhatsApp share card              | Done    | Title, deadline, and canonical link only; no contributor identity or description                                   |
| Starter kit                      | Done    | Four presets plus "copy details from one of your previous assignments"                                             |
| Copy from last semester          | Partial | Copies course details and the brief from an earlier owned assignment; it does not clone a whole class              |
| In-app feedback                  | Done    | `/settings/feedback` for authors, `/admin/feedback` for triage; no email, name, or user agent stored               |
| Weekly interviews (3–5 students) | Pending | An operational activity, not code                                                                                  |

**Exit gate:** the Phase B metrics in `PILOT_MEASUREMENT.md` have not been
measured. They require a pilot class and cannot be produced from the codebase.

## Phase C — class source of truth

All items are **Pending**: announcements with "read N/M" and polls, anti-proxy
attendance, substitute lectures, deadline-collision radar, private personal
"done" markers, tokenized ICS feeds, and leave-request QR verification packets.

## Phase D — spreading between classes

All items are **Pending**: semester rollover, cross-class brief archive, extra
officer roles, class discovery with attributed invites, self-serve class
applications, and a help/FAQ surface.

## Phase E — campus platform

**Blocked / open decision.** The lecturer role is explicitly undecided and must
not be guessed. Prodi dashboards, campus SSO/NIM allowlists, data portability,
UU PDP compliance, the cost model, and a public status page all depend on that
decision.

## Known local-only state

- Migrations `20261031120000` through `20261031220000` were applied to the
  **live** project on 2026-11-02 with owner approval, and to the local stack
  before that. Remote history now matches the repository.
- No reset, truncation, seed, or deployment was run; the push only applied the
  pending additive migrations.
- The opt-in integration suite runs against the local stack when
  `SUPABASE_TEST_*` is set and skips cleanly when the variables are absent.
  The feedback suite passed 9/9 against the local stack; the full suite could
  not be re-run after Docker was stopped.

## How to verify locally

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build

# Opt-in database suite against the local stack
supabase start
pnpm --filter web test:integration
```

Use only fake accounts and fake data. Never point the integration suite at a
project that holds real student data.
