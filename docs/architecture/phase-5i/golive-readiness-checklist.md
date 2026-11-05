# StarsTask — Go-Live Readiness Checklist

**Date:** 2026-11-05
**Purpose:** track the path from the current “wired but inert” state to a pilot in one university.
**Status:** execution plan; do not check boxes until evidence is recorded.

## 0. Safety gate (must pass before any DB/production work)

- [ ] `git status` reviewed; unrelated user work identified and protected
- [ ] `supabase/migrations/20261110000000_subject_enrollment.sql` remains quarantined and unexecuted
- [ ] production credentials are not used from this machine
- [ ] a database backup / restore point is available and tested
- [ ] a staging environment is available and isolated from production
- [ ] the rollback procedure is approved and written down

## 1. Platform decision gate

- [ ] ADR-002 approved by Platform Admin (registry, activation)
- [ ] target university/site for pilot selected
- [ ] registry mapping provided for legacy `profiles.university` values
- [ ] activation lifecycle approved (`registered` → `pending` → `active`)
- [ ] owner of manual mapping confirmed
- [ ] invite usage policy approved
- [ ] grading CSV format approved
- [ ] multi-home / active university behavior decided

## 2. Mapping review (read-only)

- [ ] run `node scripts/university-mapping-dry-run.mjs --local` (or approved staging read) against a safe target
- [ ] `university-mapping-dry-run.csv` generated and shared with reviewers
- [ ] every variant assigned to one proposed university or marked `AMBIGUOUS`/`MISSING`
- [ ] ambiguous cases assigned to a reviewer
- [ ] unknown variants reviewed manually
- [ ] output report confirms nothing was changed in the database

Suggested order: exact normalized match → fuzzy candidate → human confirmation.

## 3. Backup and rehearsal

- [ ] `pg_dump` or platform-native backup completed
- [ ] restore tested on staging
- [ ] row counts recorded for key tables: `profiles`, `classes`, `class_members`, attendance tables, assignments, grades
- [ ] two-university synthetic dataset prepared (University A, University B)
- [ ] cross-university negative tests executed
- [ ] migration applied on staging against a copy only
- [ ] validation migration executed and archived
- [ ] before/after counts compared (zero unexpected losses)

## 4. Backfill (staging first)

Do not run until steps 1–3 complete.

- [ ] `universities` rows created/verified for each pilot university
- [ ] `university_memberships` created idempotently from approved mapping
- [ ] `student_identities` created where student data is complete
- [ ] home class linked for each expected student
- [ ] counts reported per university/class
- [ ] missing/ambiguous rows reported and left unmapped
- [ ] no legacy rows modified or deleted
- [ ] no NIM overwrites

## 5. School-specific integration verification

- [ ] user with one university sees that university only
- [ ] user with multiple memberships selects context explicitly (never silently picked)
- [ ] inactive/pending university cannot access academic functions
- [ ] class admin boundary obeyed (Class A admin cannot mutate Class B)
- [ ] enrollment/retake does not mutate home class
- [ ] attendance meetings visible only in authorized scope
- [ ] announcements visible only to class members
- [ ] notifications route only within authorized tenant

## 6. Functional pilot rehearsal

- [ ] login (Google OAuth PKCE) works
- [ ] profile retrieval works
- [ ] university selection works
- [ ] home class shown (existing members included)
- [ ] attendance meeting created by authorized Class Admin
- [ ] attendance can be recorded and corrected with reason
- [ ] correction ledger is append-only
- [ ] export (if approved) produces valid Excel/PDF
- [ ] frontend shows safe empty states for no-network, no-data, no-permissions
- [ ] pre-existing attendance data remains readable

## 7. Production gate

- [ ] Platform Admin explicitly approves production rollout
- [ ] backup taken immediately before
- [ ] maintenance window scheduled
- [ ] rollout plan: one university / one cohort first
- [ ] rollback trigger defined (e.g. identity validation failure > 0.5%)
- [ ] monitoring of audit logs, RLS denials, failed RPCs for 48h
- [ ] user communication and support channel ready
- [ ] direct phone/wa support for administrators

## 8. Post-launch

- [ ] weekly attendance completion metrics
- [ ] weekly error/denial review
- [ ] collect 30-user feedback cohort report
- [ ] one case study per pilot class
- [ ] decide next university after measurable success
- [ ] WIP migration excluded from every release branch

## Current blockers (as of 2026-11-05)

1. Platform approval ADR-002 / registry activation
2. Mapping approval for legacy university strings (there is no safe auto-mapping)
3. Invite usage policy
4. Grading CSV format
5. Backfill/rehearsal environment approval

## Recommended order

```
mapping review → backup/staging → backfill rehearsal → pilot one cohort
→ 2 weeks observation → 5J hardening → next university
```

Nothing on this list authorizes production access or data changes without the owner’s explicit approval.
