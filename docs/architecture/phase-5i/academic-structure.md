# 5I-C — Academic Structure

**Status: COMPLETE** (read paths + platform-admin academic-year create; activation dependency everywhere else)

## What shipped

| File                                                                      | Role                                                                                                                                      |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/lib/db/academic-structure.ts`                               | `listAcademicUnits`, `listAcademicYears`, `listSemesters`, `getClassAcademicLink`                                                         |
| `apps/web/src/lib/academic/unit-tree.ts`                                  | `buildUnitTree` / `flattenUnitTree` (pure, tested)                                                                                        |
| `apps/web/src/lib/db/course-offerings.ts`                                 | `listOfferingsForClass`, `listOpenOfferingsForUniversity`, `countActiveEnrollments`, `listMyEnrollments`, `getMyHomeMembership`           |
| `apps/web/src/app/(workspace)/dashboard/classes/[slug]/academic/page.tsx` | Hub: link status, structure card, offerings w/ enrollment counts, unit registry preview, subpage links, platform-admin academic-year form |
| `apps/web/src/components/academic/academic-year-form.tsx`                 | Platform-admin create form → `POST /api/admin/academic-years`                                                                             |
| `apps/web/src/app/api/admin/academic-years/route.ts`                      | Zod-validated; `requirePlatformAdmin`; service-role insert; clears previous `is_current` first (partial unique index); audit-logged       |

## Per requirement

- **Units list (parent-child):** registry preview card on the hub (depth-limited) via `buildUnitTree` (orphans surfaced at root, name-sorted siblings). Units are read-only for clients (RLS `is_university_member`); no unit write UI exists (operator-managed).
- **Academic years: list + create authorized:** list via RLS for university members; **create is platform-admin only** (no university-admin delegation exists yet — decision D-5I-1). `is_current` swap is handled server-side before insert.
- **Semesters: list:** shipped on the hub (registry counts + linked semester name). No create/edit UI (not requested; operator-managed).
- **Classes integrate new data, legacy preserved:** hub reads `classes.university_id / academic_unit_id / academic_year_id / semester_id / entry_year / code` without touching any legacy query; legacy class pages are byte-identical except one additive link on the manage page ("Academic administration (new)").
- **Offerings/enrollments read path (verified):** `course_offerings_member_read` (class member OR university member OR platform admin) and `enrollments_member_read` (university member) were read in the migration before wiring. Reads ship; **no writes** (enrollment creation stays admin/invite-driven).
- **Global vs university catalogue:** NOT locked. Offerings are returned as stored, unfiltered by catalogue scope; `courses.university_id` (nullable, decision #2) is untouched and unused by filters.
- **Academic context in dashboard:** `AcademicContextCard` (university short name, student id, home class or "not linked" CTA). It renders nothing on failure.

## Tenant-unlinked behavior

Legacy classes have `university_id NULL`; composite FKs then allow nothing for the new domains. Every new academic page renders `ClassUnlinkedNotice` instead of guessing. This is the expected steady state until the platform links classes and provisions memberships.

## Empty-state reality check

With zero memberships/linked classes in any current environment, all new surfaces show empty states. This is by design; they light up only after platform activation.
