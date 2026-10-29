# Product Requirements — StarsTask

## 1. Problem

Assignment briefs are scattered across group chats, PDFs, and screenshots. Students
starting a course cannot see what a task actually asks for until someone forwards it, and
the same brief is re-shared every semester.

## 2. Product

A public, searchable archive of university assignments. Browsing is open. Contributing
requires a Google account. Contributors manage only their own entries.

## 3. Users

**Visitor** — has no account. Wants to find an assignment for a course and read the brief,
deadline, references, and attachments.

**Contributor** — signed in with Google. Wants to publish a brief quickly, fix a typo
later, and remove something they regret posting.

**Course coordinator (implicit)** — not a role in the product. No admin UI exists.

## 4. Jobs to be done

1. "Show me assignments for Database Systems, newest first."
2. "Which of my assignments are due this week?"
3. "I have the brief for this course — let me add it in under two minutes."
4. "That description had a wrong deadline — let me fix it."
5. "I uploaded the wrong file — let me remove the assignment."

## 5. Scope (MVP)

### Public

- Homepage with search entry point, latest assignments, and counts.
- Listing with search (title/description), course, semester, type, tag filters, and
  newest / oldest / deadline sorting.
- Pagination with a bounded page size.
- Detail page with description, metadata, tags, references, attachments, contributor.
- Deadline state: none, upcoming, due today, overdue.
- Empty, loading, and error states.

### Authenticated

- Google-only sign-in with return to the originally requested internal page.
- Submit an assignment with up to three attachments (10 MB each).
- My Assignments with status filter and pagination.
- Edit title, description, course, metadata, deadline, tags, and references.
- Delete with confirmation; attachment objects are removed.
- Sign out.

### Non-goals

Email/password, OTP, additional OAuth providers, comments, ratings, notifications,
moderation UI, admin roles, public attachment buckets, mobile apps.

## 6. Functional requirements

| ID  | Requirement                  | Acceptance                                                     |
| --- | ---------------------------- | -------------------------------------------------------------- |
| F1  | Public browsing without auth | `/` and `/assignments` render for anonymous visitors           |
| F2  | Search and filters           | Query params drive results; invalid values show a reset prompt |
| F3  | Deadline handling            | Stored as `timestamptz`; rendered and compared in Asia/Jakarta |
| F4  | Google-only auth             | No password field exists anywhere                              |
| F5  | Owner-only mutations         | Server check + RLS; other users get 404/403                    |
| F6  | Ownership immutability       | `user_id` not granted for UPDATE; trigger raises if changed    |
| F7  | Public visibility            | Only `status = 'published'` appears in public queries          |
| F8  | Attachments                  | PDF/DOCX/PPTX/XLSX/PNG/JPG, ≤10 MB, ≤3 files, private bucket   |
| F9  | Validation                   | Zod on the server; DB constraints as second line               |
| F10 | Rate limiting                | Public reads and writes limited per IP or user                 |
| F11 | Safe redirects               | `next` reduced to an allowlisted internal path                 |
| F12 | Empty/error states           | Every data view has an explicit empty and failure state        |

## 7. Non-functional requirements

- **Security**: RLS on all exposed tables, no service-role key in the runtime, generic
  errors, security headers, no secrets in logs.
- **Accessibility**: semantic landmarks, labelled controls, visible focus, skip link,
  `aria-live` status, reduced-motion support, 4.5:1 body contrast.
- **Performance**: server-rendered public pages, indexed queries, pagination, bounded
  sitemap, short shared cache for the public list API.
- **SEO**: per-page metadata, canonical URLs, Open Graph, sitemap, robots, stable URLs.
- **Maintainability**: strict TypeScript, one data-access layer, Zod contracts shared
  between client and server, migrations as the schema source of truth.

## 8. Success signals (not instrumented)

- A visitor can find a relevant assignment in under three interactions.
- A contributor can publish a brief without reading documentation.
- No cross-user mutation is possible through URL or payload manipulation.

## 9. Explicitly unverified

- Live Google OAuth round-trip.
- Production deployment.
- RLS suite against a real project.
- Real attachment upload/download against Supabase Storage.

These require external configuration that this repository does not perform.
