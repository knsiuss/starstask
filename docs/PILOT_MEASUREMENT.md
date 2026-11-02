# Pilot Measurement and Evidence-Based Backlog

> **Status: plan, not results.** No pilot has run. Every target below is a proposal for the
> owner to approve before launch. This repository has no product analytics, no session
> replay, and no third-party tracking, and the pilot does not add any.

This document answers one question: **after two to four weeks with one real class, what
evidence tells us whether StarsTask is safe and useful enough for a wider pilot?** It pairs
with [PILOT_RUNBOOK.md](./PILOT_RUNBOOK.md), which covers setup, operations, incidents, and
data handling.

## 1. Constraints

- Measure with what already exists: aggregate SQL, the internal developer console, platform
  logs, and what people tell us. Do not add an analytics SDK to answer a pilot question.
- Report aggregates only. Do not put names, emails, student IDs, evidence, request text, or
  push endpoints in a report.
- Do not report a percentage on a denominator below five. Use raw counts and mark them as a
  small sample.
- Do not infer intent from silence. If nobody reports a problem, that is not evidence the
  flow works.
- Correctness and security findings outrank every engagement metric. A high adoption number
  does not excuse a cross-class disclosure.

## 2. Questions the pilot must answer

| ID  | Question                                                                                      | Why it matters                                 |
| --- | --------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Q1  | Can an invited student sign in and reach the class without help?                              | Adoption fails if the first five minutes fail. |
| Q2  | Can a class run one week of assignments, sessions, and absences without falling back to chat? | This is the product's core promise.            |
| Q3  | Does a class admin complete review and forwarding faster than the current manual process?     | Admin time is the scarce resource.             |
| Q4  | Do reminders and check-in work reliably enough to be trusted?                                 | Silent failure is worse than no notification.  |
| Q5  | What blocks or annoys people enough that they stop using it?                                  | This becomes the evidence-based backlog.       |
| Q6  | Are there any security, privacy, or data-integrity incidents?                                 | A single credible incident can end the pilot.  |

Q6 is a gate, not a score. Any P0 finding stops the pilot regardless of the other answers.

## 3. Metric set

All targets are **proposed**; the owner signs off before launch. Metrics that cannot be
measured without new instrumentation are marked and deliberately left out.

### 3.1 Adoption and activation

| Metric                 | Definition                                                     | Source                                            | Proposed target         |
| ---------------------- | -------------------------------------------------------------- | ------------------------------------------------- | ----------------------- |
| Invitation acceptance  | Members in the pilot class ÷ students invited                  | `class_members` count and the owner's invite list | ≥ 90% within 72 hours   |
| First-session success  | Members who signed in at least once after joining              | `auth_activity_events` joined to the class roster | ≥ 95% of joined members |
| Week-one participation | Members with at least one core action in the first seven days  | Activity union in §4.1                            | ≥ 80% of joined members |
| Admin activation       | Class admin publishes one real post and reviews one submission | `assignments`, `assignment_reviews`               | Complete before day 3   |

### 3.2 Core task success

| Flow                  | Definition of success                                                       | Source                                    | Proposed target                       |
| --------------------- | --------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------- |
| Publish a class post  | A post reaches `published` and is visible to a non-admin member             | `assignments.status`                      | First post on launch day              |
| Submit and review     | A student submission reaches `approved` or `rejected` with a reason         | `assignment_reviews`                      | ≥ 90% decided within one business day |
| RSVP                  | Member's RSVP is stored once; capacity is never exceeded                    | `discussion_session_rsvps`                | Zero double bookings or over-capacity |
| Check-in (if enabled) | Member checks in inside the radius on the first attempt                     | `discussion_session_checkins`             | ≥ 80% without a manual override       |
| Absence request       | Request reaches `forwarded`; the PDF opens and references match             | `leave_requests`, `leave_request_history` | ≥ 90% forwarded without data loss     |
| Reminder (if enabled) | Exactly one delivery per reminder window; no duplicate on a second cron run | `notification_deliveries`                 | Zero duplicates; ≥ 95% `sent`         |

### 3.3 Reliability and safety

| Metric           | Definition                                                             | Source                                      | Proposed target                     |
| ---------------- | ---------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------- |
| Sign-in failures | `sign_in_failed` events, excluding users who cancelled consent         | `auth_activity_events`                      | No repeatable failure pattern       |
| Server errors    | 5xx responses during core hours                                        | Vercel function logs                        | No burst; every burst explained     |
| Cron execution   | Expected runs recorded, each returning `200`                           | Scheduler history and route logs            | No missed day while push is enabled |
| Uptime           | Pilot origin reachable during core hours                               | Manual checks or an external uptime monitor | No outage longer than 30 minutes    |
| Security/privacy | Confirmed cross-class reads, auth bypasses, secret exposure, data loss | Incident log                                | Zero P0; zero unresolved P1         |
| Data loss        | Content or evidence that cannot be recovered                           | Incident log and user reports               | Zero                                |

### 3.4 Experience

| Signal                   | Method                                                      | Proposed target                         |
| ------------------------ | ----------------------------------------------------------- | --------------------------------------- |
| Perceived usefulness     | Exit survey: "I would keep using this for this class" (1–5) | ≥ 70% answer 4 or 5                     |
| Preference over chat     | Exit survey: prefer StarsTask / prefer chat / no preference | StarsTask preferred by a majority       |
| Time to publish          | Observed on three posts by the class admin                  | Under five minutes once files are ready |
| Time to forward absences | Observed on three requests                                  | Under three minutes per request         |
| Top blocker              | Exit survey and weekly check-in, coded into themes          | Every theme has an owner and a decision |

## 4. How to collect it

### 4.1 Aggregate SQL

Run these in the Supabase SQL editor as the project owner. Replace
`<PILOT_CLASS_ID>` and `<PILOT_START>` (`YYYY-MM-DD`). Every query returns counts only. Do
not export raw rows, and do not paste results containing a person's identity into a report.

**Weekly active members** — one row per week, distinct people who did anything:

```sql
with
  members as (
    select
      user_id
    from
      public.class_members
    where
      class_id = '<PILOT_CLASS_ID>'
  ),
  activity as (
    select
      user_id,
      created_at as at
    from
      public.assignments
    where
      class_id = '<PILOT_CLASS_ID>'
    union all
    select
      c.user_id,
      c.completed_at
    from
      public.assignment_completions c
      join public.assignments a on a.id = c.assignment_id
    where
      a.class_id = '<PILOT_CLASS_ID>'
    union all
    select
      r.user_id,
      r.updated_at
    from
      public.discussion_session_rsvps r
      join public.discussion_sessions s on s.id = r.session_id
    where
      s.class_id = '<PILOT_CLASS_ID>'
    union all
    select
      c.user_id,
      c.updated_at
    from
      public.discussion_session_checkins c
      join public.discussion_sessions s on s.id = c.session_id
    where
      s.class_id = '<PILOT_CLASS_ID>'
    union all
    select
      l.student_id,
      l.updated_at
    from
      public.leave_requests l
    where
      l.class_id = '<PILOT_CLASS_ID>'
  )
select
  date_trunc ('week', activity.at) as week,
  count(distinct activity.user_id) as active_members
from
  activity
  join members on members.user_id = activity.user_id
where
  activity.at >= '<PILOT_START>'
group by
  1
order by
  1;
```

**Assignment funnel** — how many posts were created, still pending, or published:

```sql
select
  count(*) as posts,
  count(*) filter (
    where
      status = 'pending'
  ) as pending,
  count(*) filter (
    where
      status = 'published'
  ) as published
from
  public.assignments
where
  class_id = '<PILOT_CLASS_ID>'
  and created_at >= '<PILOT_START>';
```

**Review latency** — average hours from post creation to first approval. Class-admin posts
skip review, so read this next to the funnel rather than alone:

```sql
with posts as (
  select
    a.id,
    a.created_at,
    min(r.created_at) filter (where r.decision = 'approved') as approved_at
  from public.assignments a
  left join public.assignment_reviews r on r.assignment_id = a.id
  where a.class_id = '<PILOT_CLASS_ID>'
    and a.created_at >= '<PILOT_START>'
  group by a.id, a.created_at
)
select
  count(*) as posts,
  count(approved_at) as approved,
  round(avg(extract(epoch from (approved_at - created_at)) / 3600)::numeric, 1)
    as avg_hours_to_approve
from posts;
```

**Session attendance** — RSVPs, check-ins, and manual overrides per session:

```sql
select
  s.title,
  s.starts_at,
  (
    select
      count(*)
    from
      public.discussion_session_rsvps r
    where
      r.session_id = s.id
      and r.status = 'going'
  ) as going,
  (
    select
      count(*)
    from
      public.discussion_session_checkins c
    where
      c.session_id = s.id
  ) as checkins,
  (
    select
      count(*)
    from
      public.discussion_session_checkins c
    where
      c.session_id = s.id
      and c.method = 'manual'
  ) as manual_overrides
from
  public.discussion_sessions s
where
  s.class_id = '<PILOT_CLASS_ID>'
  and s.starts_at >= '<PILOT_START>'
order by
  s.starts_at;
```

**Absence funnel** — request statuses only:

```sql
select
  status,
  count(*) as requests
from
  public.leave_requests
where
  class_id = '<PILOT_CLASS_ID>'
  and created_at >= '<PILOT_START>'
group by
  status
order by
  status;
```

**Sign-in outcomes and push ledger** — service-role tables, aggregate only:

```sql
select
  event_type,
  count(*) as events
from
  public.auth_activity_events
where
  created_at >= '<PILOT_START>'
group by
  event_type
order by
  event_type;

select
  reminder_type,
  status,
  count(*) as deliveries
from
  public.notification_deliveries
where
  created_at >= '<PILOT_START>'
group by
  reminder_type,
  status
order by
  reminder_type,
  status;
```

The push query is global rather than per class because `notification_deliveries` is keyed
by assignment, not class. If another class shares the project, filter by the pilot dates and
say so in the report.

### 4.2 Observation

Watch three tasks with consent, once with a student and once with the class admin. Do not
record screens, audio, or names. Write down only: task, start time, completion, where they
hesitated, and what they said they expected. Stop the session if a participant opens
personal evidence.

### 4.3 Exit survey

Keep it short and anonymous. Suggested questions:

1. Which parts of StarsTask did you use this week? (assignments, sessions, check-in,
   absence, calendar link, notifications; choose all)
2. Could you find the latest assignment without asking anyone? (yes / partly / no)
3. Could you submit, RSVP, or file a request without help? (yes / partly / no)
4. What almost stopped you? (free text)
5. Did notifications arrive and open the right page? (yes / no / I did not enable them)
6. Did you have to fall back to WhatsApp for class business? (yes / no; what for)
7. Time saved or lost compared with the current process? (much more time / a little more /
   about the same / less time)
8. Would you keep using StarsTask for this class? (1–5)
9. What should be fixed first? (free text)

Do not ask for name, email, or student ID. If follow-up is needed, collect consent
separately and store it outside the survey results.

### 4.4 Weekly check-in

Thirty minutes with the class admin at the end of each week:

- What did students ask you to do for them?
- What did you do manually that the product should have done?
- Which notification, if any, was missed?
- Did anything look like it belonged to someone else?
- What should be fixed before next week?

Record answers as themes, not transcripts. A theme becomes a backlog item only after it
passes the triage rule in §6.

## 5. Evidence ledger

One row per observation. This is the only place pilot findings live; do not scatter them
across chat threads.

| Field            | Content                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| Date             | `YYYY-MM-DD`                                                                                      |
| Source           | Survey, observation, check-in, SQL aggregate, log, incident                                       |
| Flow             | Sign-in, onboarding, join, publish, submit, review, RSVP, check-in, absence, notification, export |
| Observation      | What happened, in one or two sentences                                                            |
| Frequency        | `n` of `N`, or "single report"                                                                    |
| Severity         | P0 / P1 / P2 / P3 per the runbook                                                                 |
| Evidence pointer | Query name, ticket id, or redacted screenshot path                                                |
| Decision         | Fix now, schedule after pilot, needs more evidence, won't fix                                     |

Never put raw personal data in the ledger. "Three students could not find the session
link" is evidence; a screenshot with their names is a privacy incident.

## 6. Triage and backlog

### 6.1 Rules during the pilot

- Fix P0 immediately and stop the pilot.
- Fix P1 the same day if possible; otherwise communicate the workaround and roll back if
  the recent release caused it.
- Fix a P2 during the pilot only if it blocks a core flow for the class.
- Everything else waits. Adding features mid-pilot makes it impossible to tell what changed
  the result.
- A security or correctness fix does not need a frequency threshold. One credible report is
  enough.
- A usability change needs either two independent reports or one reproducible observation,
  plus a clear affected flow.

### 6.2 Backlog item

```text
Problem:      What the user could not do, and where.
Evidence:     Ledger ids or metric values. No personal data.
Impact:       Who is affected, how often, and what it costs them.
Proposed fix: The smallest change that addresses the cause.
Risk:         What the change could break; security and data implications.
Effort:       S / M / L, with the affected files or migration if known.
Decision:     Fix now / after pilot / needs evidence / won't fix (reason).
```

### 6.3 Ordering

Rank by **severity × reach × confidence ÷ effort**, then apply the pilot rules above. A
security issue always outranks a cosmetic one, even if fewer people hit it. Do not use
engagement metrics to argue for a feature while a P1 is open.

## 7. Exit decision

At the end of the pilot, produce a one-page scorecard and decide with the owner.

| Criterion                                  | Result | Pass? |
| ------------------------------------------ | ------ | ----- |
| Invitation acceptance target met           |        |       |
| Week-one participation target met          |        |       |
| Core flows complete without developer help |        |       |
| Zero P0 incidents                          |        |       |
| No unresolved P1                           |        |       |
| No unrecoverable data loss                 |        |       |
| Majority would keep using it               |        |       |
| Every reported theme has a decision        |        |       |

Outcomes:

- **Continue to a wider pilot** — all safety gates pass, adoption and core-flow targets are
  met or narrowly missed with a known fix, and participants want to keep using it.
- **Fix and repeat** — safety gates pass, but one or two specific blockers kept people from
  the core flow. Fix them, then repeat with the same class for a shorter window.
- **Stop** — a P0 incident is unresolved, data loss is unrecoverable, or participants do
  not return even when the flow works.

Record the decision, the evidence behind it, and what would change the answer. Do not
describe a failed target as "close enough" without saying which target and by how much.

## 8. Instrumentation gaps

Measure these only with what exists, or accept that they are unknown:

- Push click-through. The service worker opens a page but reports nothing back; use the exit
  survey.
- Time spent per task. There is no client analytics; observe three sessions manually.
- Feature discoverability. Infer from questions and support reports, not clicks.
- Search quality. No search-event log exists; ask users to describe a failed search.
- Notification delivery to a specific person. The ledger stores status, not payload content;
  never reconstruct or log a payload to investigate.

Do not close these gaps by adding Google Analytics, a pixel, session replay, or a custom
event pipeline during the pilot. If the owner wants one of them later, it needs a privacy
decision and a separate change.

## 9. Reporting rules

- Reports contain aggregates, themes, and decisions. No names, no emails, no student IDs, no
  evidence images, no raw request text.
- Suppress cells below five people; say "fewer than five" instead.
- Quote a participant only with explicit permission and without identifying context.
- Keep the raw evidence ledger in an owner-controlled location and delete it at pilot exit
  unless the retention decision says otherwise.
- State honestly which metrics are missing. "Not measured" is a valid result and is better
  than a fabricated trend.
