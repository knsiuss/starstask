# Attendance Redesign — Design Reference

Native Android (Jetpack Compose) reference for the glossy iOS-style visual language
introduced by the Attendance tab. Use this as the parity checklist when migrating
**Leave Requests** and **Assignments** to the same shell.

Status: attendance implementation is wired. Leave/Assignments are **not** migrated; this doc is the plan for doing so. Build health tracks the working tree; at the time of writing the full-module build fails on untracked parallel-agent `classdir/*Glossy.kt` files, not on any attendance file.

## 1. Page anatomy

Top to bottom, on a `mockPageBrush()` page background:

1. Shared shell chrome (`StarsTaskNavHost.kt`): `StarsTaskTopBar` — hamburger → drawer, BrandMark + “StarsTask” wordmark, moon/sun theme toggle (light↔dark, persisted via DataStore `theme_mode`), bell with unread badge (`9+` cap; hidden when `loadWorkspaceContext()` fails). Floating 5-tab bottom dock (`FloatingNavDock`): Dashboard · Assignments · Attendance · Schedule · My Class. Weight-hint clearance at the bottom of every list: `contentPadding(bottom = 104.dp)`.
2. Large title block (`AttendancePageHeader` in `AttendanceDashboardSections.kt`): “Attendance” 30sp Bold `palette.ink`, letterSpacing −0.5sp, lineHeight 36.sp; subtitle 15sp `palette.muted`, lineHeight 21.sp; thin `StarsTaskSegmentedTabs` (Check-in | History).
3. Cards — radius 20.dp, 1.dp `palette.cardBorder`, fill `palette.card`, no shadow.
4. Grouped white list card — rows separated by hairline dividers (`HorizontalDivider(palette.hairline, 0.5.dp)`), code chip on `palette.chip` radius 12dp.
5. Section header row — “Course Attendance” 22sp SemiBold `palette.ink` + trailing “View all” accent `palette.accent` bodySmall TextButton (route `attendance/courses`).

## 2. Token table (`ui/theme/MockTokens.kt`)

| Token                       | Light             | Dark              |
| --------------------------- | ----------------- | ----------------- |
| `pageTop` → `pageBottom`    | #E9EFFC → #F7F8FB | #0E1524 → #12161F |
| `card`                      | #FFFFFF           | #161D2B           |
| `cardBorder`                | #E7EAF4           | #232C3F           |
| `hairline`                  | #EDEFF5           | #232C3F           |
| `chip`                      | #EDF0F7           | #1F2636           |
| `ink`                       | #111B33           | #E8ECF6           |
| `muted`                     | #6B7280           | #9AA5B8           |
| `accent`                    | #2F5BFF           | #7EA0FF           |
| `accentSoft`                | #E4EBFF           | #1F2A44           |
| `accentSofter`              | #EEF2FF           | #1A2234           |
| `dockBar` (alpha dock fill) | #FFFFFF           | #E6161D2B         |
| `dockBorder`                | #EDEFF5           | #232C3F           |
| `halo`                      | #DCE7FF           | #182347           |
| `goodBg` / `goodFg`         | #E1E9FF / #2F5BFF | #1E2B4A / #9DBCFF |
| `riskBg` / `riskFg`         | #FBE3E6 / #D64550 | #33202A / #F1A5AE |
| `fairBg` / `fairFg`         | #FBF3E4 / #8A5A1E | #332A1C / #D9A441 |
| `skeleton`                  | #E4E8EF           | #1F2636           |

Usage: `val palette = mockColors()` — it reads `LocalDarkTheme`, never a raw system setting, so the user’s toggle wins. Background: `Modifier.background(mockPageBrush())` (vertical gradient pageTop → pageBottom).

## 3. Idiom checklist

- Gutters: `Spacing.Section` (16.dp) left/right; top `Spacing.Sm`; bottom 104.dp (dock clearance).
- Vertical rhythm: `Spacing.Xxl` (14.dp) between sections, `Spacing.Lg` (10.dp) inside a section, `Spacing.Md` (8.dp) row-level.
- Cards: `clip(RoundedCornerShape(20.dp))` + `background(palette.card)` + `border(1.dp, palette.cardBorder)`. No elevation/shadow on content cards; shadow belongs to the dock and the managed primary CTA only.
- Title: 30sp Bold, −0.5sp letterSpacing, `palette.ink`. Subtitle: 15.sp/21.sp `palette.muted`.
- Section header: 22.sp SemiBold `palette.ink`; trailing action 13sp `palette.accent` (Check-in | History or View all).
- Icon tiles: rounded square/pill `palette.accentSoft` tile + `palette.accent` icon at 18–20dp.
- Code chips: `palette.chip` fill, `RoundedCornerShape(12.dp)`, 12sp SemiBold `palette.ink`.
- Badges: use `StarsTaskBadge` + `BadgeVariant`, mapped from status in `AttendanceDashboardRows.kt` — Excellent/Present→SUCCESS (or ACCENT for Good), Fair/Late/Pending→WARNING, AtRisk/Absent→DANGER, Excused/Sick→ACCENT, NoSessions→NEUTRAL.
- GPS check-in CTA keeps accent solid + white SemiBold text.
- Reuse, don’t recreate: `WebSkeletonCard` (3× while loading), `WebAlert` + `WebButton(SECONDARY)` Retry, `WebEmptyState`, `StarsTaskBadge`.

## 4. Dark mode

- Only source: `mockColors()` / `mockPageBrush()` (both read `LocalDarkTheme`). No raw `Color(0x...)` inside restyled screens; hex belongs in `MockTokens.kt`.
- `values/themes.xml` remains light-hardcoded (pre-existing); the Compose tree above it is theme-aware. Not touched by this redesign.

## 5. Detail screens

- Course detail (`AttendanceDetailScreens.kt`, `AttendanceDetailCards.kt`): back pill (`accentSoft`, `ChevronLeft`), 22.sp SemiBold title, 2×2 metric grid of `OverviewCard`s (Total/Present/Late/Absent — tiles are `accentSofter`, radius 10–12dp), accent/fair/risk colored icon tiles, hairline dividers, 13sp muted footnote policy.
- Session detail (`AttendanceSessionDetail.kt`): “Attendance record not found.” fallback + back; status note cards tinted `goodBg` / `fairBg` / `chip`; details box radius 12dp with hairline dividers between rows.
- Filter sheet (`AttendanceFilterSheet.kt`): `ModalBottomSheet` with `containerColor = palette.card`; selected option row = `accentSoft` fill + `palette.accent` text + `Lucide.Check`; Apply = accent SemiBold, Reset = muted. Selection state is staged locally and applied once on confirm; From/To dates use in-sheet `DatePickerDialog`s; sheet state held via `remember { mutableStateOf(...) }` so selection feedback recomposes.
- History tab actions are real, not stubbed: filter state lives on `AttendanceScreen` and applies in-memory; CSV/PDF exports run through `attendanceCsv` / `attendancePdfBytes` and share via `shareFile()` (FileProvider declared in `AndroidManifest.xml`, paths `res/xml/file_paths.xml`).

## 6. Migration checklist for Leave Requests / Assignments

1. Wrap the screen content in `mockPageBrush()`; delete any per-screen pastel gradient background.
2. Replace the old top area with `StarsTaskTopBar` behavior parity (already global via NavHost — don’t duplicate).
3. Replace the title block with 30sp Bold + 15sp subtitle in `palette.ink`/`palette.muted`; replace chips/borders/shadows with section 3 idioms.
4. Swap badge mapping to `StarsTaskBadge` variants (section 3); don’t invent per-screen pill styles.
5. Grouped white card + hairline dividers for any list that mimics “Course Attendance”.
6. Bottom padding 104.dp on every scroll container; keep the dock’s `baseRoute()` behavior if the tab hides the dock (Leave does today).
7. No `Theme.kt` forks: color comes from `mockColors()`, spacing from `Spacing`, radii inline as 12/20/22.dp.
8. Build gate: `:app:compileDebugKotlin` must show zero errors from your migrated files. Pre-existing errors in unrelated in-flight files (e.g. `classdir/*Glossy.kt`) are the owner’s to fix — report, don’t patch.

## 7. Non-goals for this redesign

- Web (`apps/web`) — separate surface; the mock is native only.
- `Theme.kt` refactor — intentionally untouched; `MockTokens.kt` is the new single source for the glossy palette.
- Notification/dashboard (“Build to learn”) home screen — out of scope.
- GPS check-in business logic, data layer (`data/Attendance*.kt`, `AttendanceExport.kt`) — untouched behavior.
