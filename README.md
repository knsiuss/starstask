# StarsTask

**A collaborative academic platform for sharing and managing assignments, classes, and student administration.**

StarsTask helps students and lecturers discover, contribute, and organize academic assignments in one place. Anyone can browse content openly, while actions that create or modify data require authentication and are protected by role-based access control.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [Authentication Setup](#authentication-setup)
- [Push Notifications and PWA](#push-notifications-and-pwa)
- [Security](#security)
- [Development Guidelines](#development-guidelines)
- [Deployment](#deployment)
- [Project Status](#project-status)
- [Contributing](#contributing)
- [License](#license)

## Overview

StarsTask is built around three principles:

- **Open access:** browse available assignments without creating an account.
- **Accountability:** authenticate before submitting or managing contributed content.
- **Structured collaboration:** organize academic resources and class workflows with clear permissions.

## Features

| Area                    | Description                                                              |
| ----------------------- | ------------------------------------------------------------------------ |
| Public browsing         | Explore published assignments without signing in.                        |
| Authentication          | Sign in with Google through Supabase Auth.                               |
| Assignment management   | Submit, edit, and delete your own assignments; attach up to three files. |
| Search and filters      | Filter by course, semester, type, tag, and deadline; full-text search.   |
| Deadline reminders      | Opt-in Web Push reminders 24 hours and 3 hours before a deadline.        |
| Saved assignments       | Follow an assignment you do not own to receive its reminders.            |
| PWA                     | Installable manifest and a push-only service worker.                     |
| Access control          | Server-side authorization plus RLS and private storage.                  |
| Classes and roles       | Planned — not implemented in this repository yet.                        |
| Leave requests          | Planned — not implemented.                                               |
| OCR document extraction | Planned — not implemented.                                               |
| CSV / PDF exports       | Planned — not implemented.                                               |

> This table reflects the code in this repository. Planned rows are intentionally not
> described as working features.

## Tech Stack

| Technology                                    | Purpose                                                    |
| --------------------------------------------- | ---------------------------------------------------------- |
| [Next.js](https://nextjs.org/) (App Router)   | Web application and routing                                |
| [TypeScript](https://www.typescriptlang.org/) | Type safety                                                |
| [Tailwind CSS](https://tailwindcss.com/)      | Styling and responsive UI                                  |
| [Supabase](https://supabase.com/)             | Authentication, PostgreSQL database, RLS, and file storage |
| [Vercel](https://vercel.com/)                 | Application deployment and cron scheduling                 |
| Web Push (VAPID)                              | Deadline reminders through `web-push`                      |
| Google OAuth                                  | User authentication                                        |
| pnpm                                          | Package management                                         |
| Vitest / Playwright                           | Unit, integration, and browser tests                       |

## Getting Started

### Prerequisites

- Node.js, in a version compatible with the project's Next.js release
- [pnpm](https://pnpm.io/)
- A Supabase project
- A Google OAuth client configured for Supabase Auth

### Installation

```bash
git clone <repository-url>
cd starstask
pnpm install
```

Create a local environment file for the web app:

```bash
cp .env.example apps/web/.env.local
```

On PowerShell, use `Copy-Item .env.example apps/web/.env.local`.

The template contains placeholders for every variable, including the optional Web Push
group. See [.env.example](./.env.example) and
[docs/PUSH_NOTIFICATIONS.md](./docs/PUSH_NOTIFICATIONS.md).

### Environment Variables

Public values (safe for browser code):

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Server-only values (never prefix with `NEXT_PUBLIC_`):

```env
RATE_LIMIT_SALT=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@example.com
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
```

`SUPABASE_SERVICE_ROLE_KEY` is used only by the cron reminder endpoint.
`scripts/check-env.mjs` fails when the push group is partially configured or when a secret
is exposed through a `NEXT_PUBLIC_` variable.

> **Warning:** never commit `.env.local`, and never expose service-role keys, OAuth client
> secrets, or VAPID private keys in client-side code.

### Run the Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

The exact scripts are defined in `package.json`. Typical commands:

| Command                             | Description                                        |
| ----------------------------------- | -------------------------------------------------- |
| `pnpm dev`                          | Start the development server                       |
| `pnpm build`                        | Create a production build                          |
| `pnpm start`                        | Serve the production build                         |
| `pnpm lint`                         | Run ESLint across the workspace                    |
| `pnpm typecheck`                    | Run TypeScript type checking                       |
| `pnpm test`                         | Run unit tests                                     |
| `pnpm test:integration`             | Run the opt-in RLS suite (needs `SUPABASE_TEST_*`) |
| `pnpm test:e2e`                     | Run Playwright browser tests                       |
| `pnpm format` / `pnpm format:check` | Apply / verify Prettier formatting                 |
| `pnpm check:env`                    | Validate environment variables before deploying    |
| `pnpm db:push`                      | Apply migrations to the linked Supabase project    |
| `pnpm db:reset`                     | Reset a local Supabase instance                    |
| `pnpm db:types`                     | Regenerate `apps/web/src/types/database.ts`        |

The PWA icons are generated by `node scripts/generate-icons.mjs`.

## Authentication Setup

StarsTask uses Google authentication through Supabase Auth.

1. Create or open a Supabase project.
2. Enable Google as an authentication provider.
3. Add the Google OAuth client credentials in Supabase.
4. Register the Supabase callback URL in the Google Cloud Console.
5. Configure the application's allowed redirect URLs in Supabase.
6. Add the required environment variables locally and in the deployment environment.

The Google OAuth callback URL uses this format:

```text
https://<project-ref>.supabase.co/auth/v1/callback
```

Use your own Supabase project reference, and do not reuse credentials from another environment.

## Push Notifications and PWA

StarsTask is installable and can send deadline reminders through the browser.

- Users opt in from `/settings/notifications`; the browser permission prompt is only shown
  after a click.
- Reminders are sent about 24 hours and 3 hours before a deadline for assignments the user
  owns or saved.
- On iPhone and iPad (iOS/iPadOS 16.4+), the site must be added to the Home Screen first.
  The settings page explains this and does not show a non-working enable button in Safari.
- The service worker at `/sw.js` only shows notifications and opens the assignment. It has
  no `fetch` handler and caches nothing, so authenticated pages are never served stale.

The scheduler is a cron route protected by `CRON_SECRET`. It is not active until a cron
source is configured. On Vercel Hobby the 10-minute schedule requires Pro; see
[docs/PUSH_NOTIFICATIONS.md](./docs/PUSH_NOTIFICATIONS.md) for alternatives and the full
runbook.

## Security

Security is part of the application's foundation:

- Authorization is enforced on the server and through database policies.
- Row Level Security (RLS) protects sensitive database records.
- Private documents are kept in non-public storage buckets.
- Uploaded file types and sizes are validated on the server.
- Redirect destinations are validated to prevent open-redirect vulnerabilities.
- Secrets and privileged credentials stay out of client-side code.
- Push endpoints and subscription keys are never returned to the browser; only the public
  VAPID key is exposed.
- The service-role key is read only by the cron scheduler, and its RPCs are granted only to
  `service_role`.
- The scheduler rejects requests without a timing-safe bearer token check.

To report a vulnerability, contact the project maintainers privately instead of opening a public issue.

## Development Guidelines

- Use TypeScript and preserve strict type checking.
- Follow the existing architecture and component conventions.
- Keep components focused on a single responsibility.
- Reuse shared UI components instead of duplicating implementations.
- Keep code free of ESLint errors and warnings, and formatted with Prettier.
- Run linting, type checking, tests, and the production build before submitting changes.
- Update documentation when behavior or configuration changes.

Detailed engineering rules are in [AGENTS.md](./AGENTS.md).

## Deployment

The application is deployed on Vercel. The full runbook is
[docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md); push-specific steps are in
[docs/PUSH_NOTIFICATIONS.md](./docs/PUSH_NOTIFICATIONS.md).

1. Import the repository into Vercel with **Root Directory** set to `apps/web`.
2. Add the required environment variables for each environment.
3. Add the production domain to the allowed redirect URLs in Supabase Auth.
4. Apply all migrations to the target Supabase project before releasing.
5. Configure a cron source for `/api/cron/deadline-reminders` if reminders are enabled.
   Vercel Hobby only supports daily cron; a 10-minute schedule needs Pro or an external
   scheduler.

## Project Status

StarsTask is under active development. Assignment browsing, Google sign-in, assignment
management with attachments, saved assignments, Web Push deadline reminders, and the PWA
shell are implemented. Classes/roles, leave requests, OCR, and CSV/PDF exports are not
implemented yet. Features, interfaces, and internal details may change.

No Supabase project, Vercel deployment, VAPID key pair, or physical device was available
while this repository was built, so database, OAuth, push delivery, and cron behavior are
documented but not verified end to end.

## Contributing

Contributions and improvements are welcome.

1. Review the existing project conventions in [AGENTS.md](./AGENTS.md).
2. Keep changes focused and consistent with the current scope.
3. Verify the affected functionality.
4. Run the available checks.
5. Document any required environment or database changes in your pull request.

## License

No license has been specified yet. All rights remain with the respective copyright holder until a license is added to the repository.
