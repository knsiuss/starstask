# AGENTS.md — StarsTask Engineering Guidelines

## 1. Project Overview

StarsTask is an academic platform for students and lecturers.

The application supports:

- Public assignment browsing
- Google authentication through Supabase Auth
- Assignment submission and management
- Class management and role-based permissions
- Web Push notifications
- Student leave requests and supporting evidence
- OCR-assisted document extraction
- CSV and PDF report exports

Only implement features explicitly requested by the project owner.

## 2. Before Making Changes

- Inspect the existing repository before editing files.
- Read the relevant `package.json` files, project documentation, and existing configurations (ESLint, Prettier, EditorConfig, `tsconfig`).
- Understand existing authentication, authorization, database, and component patterns.
- Reuse existing utilities and components where appropriate.
- Identify the smallest set of changes needed.
- Never assume a feature works merely because its files exist.
- Do not rebuild working functionality without a demonstrated reason.
- Run the lint, type-check, and test commands once before editing to record the baseline. Distinguish pre-existing failures from failures you introduce.

## 3. Architecture and Code Quality

- Follow the existing monorepo and workspace conventions.
- Use TypeScript and preserve type safety.
- Prefer small, focused, reusable components.
- Keep UI components separate from business logic and data-access logic.
- Follow the existing naming conventions.
- Avoid duplicated logic, unnecessary abstractions, and oversized components.
- Use server components by default in Next.js App Router.
- Introduce client components (`"use client"`) only when browser-side interaction is required.
- Validate external input at system boundaries.
- Handle loading, empty, success, and error states appropriately.

## 4. Linting and Formatting

The repository's ESLint, Prettier, and EditorConfig files are the source of truth. Do not duplicate or contradict them in code style choices.

### 4.1 Zero-warning policy

- Code you add or modify must produce **zero ESLint errors and zero warnings**.
- Never leave unused imports, variables, parameters, or dead code.
- Do not use `any`. Prefer `unknown` with narrowing, or a precise type.
- Avoid non-null assertions (`!`) and unchecked type assertions (`as`) unless justified with a comment.
- Do not add `eslint-disable`, `@ts-ignore`, or `@ts-expect-error` to silence a problem. If unavoidable:
  - Scope it to the single line.
  - Name the specific rule.
  - Add a short reason, for example `// eslint-disable-next-line rule-name -- reason`.
- Fix the root cause of a lint error instead of loosening rules or editing lint configuration.
- Do not use `console.log` in committed code. Use the project's logging utility, or `console.error` / `console.warn` only where already accepted.
- Respect React hook rules, including complete dependency arrays. Do not suppress `exhaustive-deps` without a documented reason.
- Use `import type` for type-only imports if the project configuration prefers it.

### 4.2 Automatic formatting

- Format every changed file with Prettier. Never hand-format against Prettier output.
- Format only files you changed. Do not reformat unrelated files, which pollutes diffs.
- Use the project's existing settings for indentation, quotes, semicolons, trailing commas, and line width. Do not introduce new values.
- Keep files UTF-8 with LF line endings, no trailing whitespace, and exactly one final newline, as enforced by EditorConfig.
- Apply autofixable lint rules (`eslint --fix`) first, then run Prettier, then re-run lint to confirm a clean result.

### 4.3 Import hygiene

- Group imports in this order, with one blank line between groups:
  1. Node and framework built-ins (`react`, `next/*`)
  2. Third-party packages
  3. Workspace packages and path aliases
  4. Relative imports
  5. Style or asset imports
- Remove duplicate imports and avoid wildcard imports unless required.
- Do not create circular dependencies.

## 5. Code Layout and Visual Spacing

Prettier controls horizontal spacing. The rules below govern vertical spacing and readability, which Prettier does not enforce.

### 5.1 Blank lines

- Separate logical blocks with a single blank line. Never use two or more consecutive blank lines.
- Leave one blank line:
  - Between imports and the first declaration
  - Between top-level functions, components, types, and constants
  - Before and after multi-line `if`, `for`, `switch`, `try`, and similar blocks
  - Before a `return` statement when it follows more than a couple of lines
  - Between distinct phases of a function (validate, fetch, transform, return)
- Do not insert blank lines at the start or end of a block.
- Keep tightly related lines together, such as a short declaration followed immediately by its use.

### 5.2 Function and component structure

Order the contents of components and functions consistently:

1. Props and type definitions
2. Hooks and derived state
3. Event handlers and helpers
4. Early returns (loading, empty, error)
5. Main return or JSX

- Prefer early returns over deep nesting. Avoid more than three nesting levels.
- Keep functions focused. Extract a helper once a function exceeds roughly 40 lines or mixes responsibilities.
- Keep component files focused. Split a file once it exceeds roughly 250 lines or contains unrelated components.

### 5.3 JSX readability

- Put each prop on its own line when a tag has several props or exceeds the line width, as Prettier formats it.
- Extract long conditional rendering into named variables or small components. Avoid nested ternaries.
- Add one blank line between large sibling sections of JSX only when it improves scanning. Never leave blank lines inside a props list.
- Keep `className` strings readable. Use the project's utility (for example `cn`) for conditional classes and keep the class order consistent with the Tailwind plugin if configured.

### 5.4 Comments and naming

- Write comments to explain why, not what. Remove commented-out code.
- Keep comments short, grammatical, and placed on their own line above the code they describe.
- Use descriptive names. Avoid single-letter names except for short loop indices and conventional callbacks.
- Prefer named constants over magic numbers and repeated string literals.
- Keep types and interfaces near their use. Share them from a common module only when reused.

### 5.5 SQL and configuration files

- Format SQL migrations with uppercase keywords, one clause per line, and consistent indentation. Separate statements with a blank line.
- Keep JSON, YAML, and Markdown formatted with the project's Prettier configuration.
- Keep Markdown headings sequential, with blank lines around headings, lists, and code blocks.

## 6. UI and Design Consistency

- Inspect the existing design system before creating or modifying UI.
- Reuse existing components, design tokens, typography, spacing, and color conventions.
- Maintain consistent layouts and responsive behavior.
- Prefer clean, accessible, minimal interfaces.
- Avoid arbitrary colors, inconsistent spacing, unnecessary decoration, and duplicated UI patterns.
- Provide accessible labels, keyboard navigation, and visible focus states.
- Do not redesign unrelated pages when implementing a specific feature.

## 7. Authentication and Security

- Use the existing Supabase authentication architecture.
- Never trust client-provided user IDs, roles, or ownership claims.
- Derive authenticated identity from a verified server-side session.
- Enforce authorization on the server and through appropriate database RLS policies.
- Never expose service-role keys, OAuth client secrets, VAPID private keys, or other secrets to browser code.
- Validate redirects to prevent open-redirect vulnerabilities.
- Keep private documents in private storage.
- Validate file uploads and protect sensitive exported data.
- Do not weaken security policies to make functionality work.

### 7.1 Secrets and Data Leak Prevention

Treat every secret and every piece of personal or academic data as sensitive by default.

**Secrets and credentials**

- Never write real secrets into any file, including source code, tests, fixtures, documentation, comments, migrations, seed data, scripts, and example files. This covers API keys, service-role keys, OAuth client secrets, VAPID private keys, database URLs and passwords, JWT secrets, and access tokens.
- Use placeholder values only (for example `your-supabase-url`) in `.env.example` and documentation.
- Keep `.env`, `.env.local`, and similar files out of version control. Confirm they are listed in `.gitignore` and never `git add` them.
- Only variables prefixed with `NEXT_PUBLIC_` may reach browser code, and only for values that are safe to be public (such as the Supabase URL and anon key).
- Never prefix a secret with `NEXT_PUBLIC_`, and never import server-only modules or secrets into client components.
- Read secrets only in server-side code. Do not pass them to client components as props, serialize them into page output, or return them from API responses.
- Do not echo, print, or paste secret values into chat output, reports, terminal commands shared with the owner, or error messages. Refer to variables by name only.
- If a real secret is found in the repository or its history, do not copy it anywhere. Report its location (file and line, not the value) and recommend rotating it.

**Personal and academic data**

- Do not log personal data or sensitive content: emails, names, student IDs, leave-request details, uploaded evidence, OCR output, push subscription endpoints and keys, tokens, or session data.
- Do not use real user data in tests, fixtures, screenshots, seed files, or documentation. Use clearly fake data.
- Return only the fields a client needs from queries and API responses. Do not use `select *` for responses that cross the server-client boundary.
- Keep error messages generic for users. Do not expose stack traces, SQL errors, table names, file paths, or internal identifiers in responses.
- Never expose private storage objects through public URLs. Use short-lived signed URLs, scoped to the authorized user.
- Apply the same authorization and RLS rules to exports (CSV and PDF) as to the underlying data. Do not embed sensitive columns that the requester is not allowed to see.
- Strip or avoid metadata in generated files that could reveal private information.
- Do not send private data to third-party services, analytics, or OCR providers unless the project owner has explicitly approved it.

**Tooling and workflow**

- Do not commit build artifacts, debug dumps, database exports, HAR files, or logs, as these may contain secrets or personal data.
- Do not expose sensitive values through source maps, public folders, or client bundles. Check that production builds do not contain server secrets.
- Review `git diff` and the list of staged files for secrets and personal data before reporting a task as complete.
- Run a secret scan (for example `gitleaks` or `trufflehog`) if one is configured in the repository, and report the result honestly. If none is configured, state that it could not be run.

## 8. Database and Migrations

- Inspect the current schema before adding tables or columns.
- Reuse existing tables and relationships when appropriate.
- Use version-controlled database migrations.
- Include appropriate constraints, foreign keys, indexes, and RLS policies.
- Preserve data integrity and existing functionality.
- Do not modify production data or production credentials without explicit authorization.
- Document required manual configuration.

## 9. Dependencies and Configuration

- Prefer existing dependencies when they satisfy the requirement.
- Add a dependency only when justified.
- Avoid unnecessary framework or library replacements.
- Never commit secrets or real credentials.
- Keep environment variables documented using placeholder names.
- Do not silently replace or loosen existing ESLint, Prettier, EditorConfig, TypeScript, or workspace configurations.

## 10. Testing and Validation

After changes, run the relevant checks supported by the repository, in this order:

1. ESLint, with zero errors and zero warnings on changed files.
2. Prettier verification (`prettier --check`), if configured.
3. TypeScript type checking.
4. Unit and integration tests.
5. Production build.

- Use the scripts defined in `package.json` rather than inventing commands.
- Fix failures introduced by the changes.
- Do not claim a command passed unless it was executed successfully.
- Distinguish failed checks from checks that could not run, and state why.
- Add regression tests for meaningful bug fixes and security-sensitive behavior.
- Do not skip or weaken tests merely to obtain a passing result.

## 11. Git and Change Management

- Keep changes focused on the requested task.
- Keep diffs clean: no whitespace-only changes, no mass reformatting, no unrelated import reordering.
- Do not delete unrelated code or user changes.
- Do not reset branches, rewrite Git history, or force-push without explicit authorization.
- Do not commit or deploy unless explicitly requested.
- Before any commit, confirm that no secrets, `.env` files, personal data, or generated artifacts are staged (see Section 7.1).
- Report the files changed and the reason for each significant change.

## 12. Definition of Done

A task is complete when:

- The requested behavior is implemented.
- Existing functionality remains intact.
- Relevant security and authorization requirements are satisfied.
- No secrets, credentials, or personal data appear in code, logs, fixtures, documentation, diffs, or client-side bundles.
- Changed files pass ESLint with zero errors and warnings, and are Prettier-formatted.
- Code layout follows the spacing rules in Section 5.
- Relevant automated checks have been executed and their results reported honestly.
- Documentation is updated when necessary.
- Remaining limitations and manual setup steps are clearly reported.

Prioritize correctness, security, maintainability, and completion over adding more features.
