# Schedule import from PDF — plan

Status: **implemented** (parser, matcher, import + batch endpoints,
preview UI, and the semester-range columns). This document records the
design decisions behind the feature: a class leader (or any class member,
per current schedule permissions) uploads a lecture-schedule PDF on the
class Schedule tab and has the weekly slots created from it, matched to
the class's own courses.

Reference sample: `JADWAL KULIAH.PDF` (Universitas Pamulang, Ganjil
2026/2027) — a text-based KHS-style table with columns `NO, KODE MK, NAMA
MATA KULIAH, DOSEN, KELAS, HARI, WAKTU, PERIODE, RUANG, TGL MULAI, TGL
SELESAI`, 8 rows for class `05TPLM002`, Monday–Friday, 18.20–21.40, room
`V.117`.

## 1. Why this fits the existing system

- A text-extraction OCR provider already exists: `pdf-text`
  (`apps/web/src/lib/ocr/pdf-text.ts`, via `unpdf`). The sample PDF was
  extracted with it locally and produced clean text (1,273 chars) — **no
  image OCR, no API key, no third-party data transfer needed** for this
  format.
- `runOcr()` (`apps/web/src/lib/ocr/index.ts`) is provider-based and never
  throws; failures degrade to manual entry. New providers register in one
  place without touching routes or database code.
- Slots are already stored one row at a time through
  `POST /api/classes/[slug]/schedule`, validated by
  `classScheduleCreateSchema` (`packages/contracts/src/class-schedule.ts`).
- The UI shell already exists: `ScheduleManager` owns add/edit/remove state
  on the class Schedule tab, and the sidebar form from the recent redesign
  is the natural home for an "Import from file" entry point.

## 2. Flow

```
Upload PDF (class Schedule tab, sidebar)
  → POST /api/classes/[slug]/schedule/import   (membership-checked, flag-gated)
  → runOcr() → raw text
  → parseScheduleText() → candidate rows + warnings
  → matchSubjects() → per-row match status
  → Preview (editable) → confirm
  → save rows (batch endpoint, or existing single-row POST per row)
```

OCR never writes anything by itself. Following the leave-request OCR
pattern in this repo, the parser only **suggests**; the user confirms in a
preview before anything is saved.

## 3. Parser

New pure module, e.g. `apps/web/src/lib/ocr/schedule-parse.ts`, with unit
tests built from the sample PDF (plus variants: per-class export without
the student header).

- Split the text into row chunks by the row-number + course-code pattern
  (`^\d+\s+[0-9A-Z]+`, e.g. `1 22TIF0283`).
- Within a chunk, extract anchors that are always present:
  - day name (Senin…Minggu) → ISO weekday 1–7,
  - time range `HH.MM - HH.MM` → normalize the dot to `HH:mm`,
  - class code (`05TPLM002`) — also used to verify the file belongs to
    this class; a mismatch is a warning, not silent acceptance.
- Course name and lecturer are the text between the course code and the
  class code; multi-line cells are rejoined before use.
- Rows that fail any anchor check are returned as warnings with the raw
  chunk, never dropped silently.
- Output type (contract-level, in `@starstask/contracts` next to
  `classScheduleCreateSchema`): parsed row + match status + warnings.

## 4. Matching parsed rows to class courses

`ClassSubjectView` provides `id, name, code, lecturer_name`. Matching runs
in layers, and every row carries its confidence into the preview:

1. **Course code** — normalized (uppercase, trimmed) equality between the
   PDF `KODE MK` and `subject.code`. Most reliable when it hits; in the
   sample data subject codes are short (`PW1`) vs PDF codes (`22TIF0283`),
   so misses are expected and fine.
2. **Normalized name** — lowercase, strip punctuation, collapse spaces,
   equate roman numerals with digits (`WEB I` ↔ `WEB 1`), then exact match,
   then token-containment match. Score candidates; keep the best.
3. **Lecturer tie-break** — when several names are close, the candidate
   whose `lecturer_name` equals the PDF `DOSEN` wins.

A row is only pre-filled in the preview when a match exists; otherwise the
subject dropdown stays empty and the user picks manually. Matches are
never applied silently.

## 5. Preview UI

In the Schedule tab sidebar (or a dialog from it), after a successful
parse:

- One row per parsed slot: day, start–end, room, lecturer, subject
  dropdown (pre-filled on match), include/exclude checkbox.
- Warnings listed on affected rows (unmatched subject, wrong class code,
  unparseable row shown as raw text).
- `PERIODE` and `TGL MULAI/SELESAI` are stored: migration
  `20261105000000_class_schedule_semester_range` adds nullable `period`,
  `start_date`, and `end_date` columns to `class_course_schedules`, and the
  contract validates them (ISO dates, end not before start). Manually
  entered slots leave them null, and editing an imported slot keeps its
  range. The timetable shows "Period 1 · 31 Aug 2026 – 31 Jan 2027" when
  present.
- Confirm saves all included rows; the existing timetable and stats update
  from the same state `ScheduleManager` already maintains.

## 6. Saving

Two options, in increasing robustness:

- **A. Existing single-row POST per row** from the client — zero new API
  surface, proven by `ScheduleManager` today. Downside: partial failure
  can leave half the slots saved.
- **B. New batch endpoint** (`POST .../schedule/import:confirm` or a batch
  route) that validates every row with `classScheduleCreateSchema` and
  inserts atomically, returning per-row results. Preferred for import.

Recommendation: ship A first if speed matters; B before calling the
feature done, because a half-imported timetable is worse than none.

## 7. Security and data handling

- File handling mirrors the leave-evidence flow: size/type validation
  server-side, PDF only, bytes never logged, result never persisted
  (parsed text is discarded after the preview response).
- Authorization: same membership rule as the existing schedule write API;
  the import endpoint must not widen who can write slots.
- Gated behind the existing `ocr` feature flag
  (`NEXT_PUBLIC_FEATURE_OCR` / `isFeatureEnabled("ocr")`) with
  `OCR_PROVIDER=disabled` as the kill switch, same as leave OCR.
- No personal data from the sample header (name/NIM/shift) is stored or
  logged; the parser only reads table rows.

## 8. Testing

- Parser unit tests: the sample PDF as fixture (8 rows), multi-line
  name/lecturer cells, dot-separated times, wrong-class file, truncated
  row → warning instead of crash.
- Matcher unit tests: code hit, name hit with `I`/`1` normalization,
  lecturer tie-break, no match → empty.
- Contract tests: batch payload validation reuses
  `classScheduleCreateSchema` per row.
- Manual QA: upload the sample PDF on a test class, verify preview rows,
  confirm, and check timetable + stats refresh.

## 9. Open questions

1. Batch endpoint (B) from the start, or single-row (A) first?
2. ~~Should unmatched subjects be _created_ as new courses during import
   (admin-only?), or always picked manually in the preview?~~ **Decided and
   implemented**: unmatched rows offer "Create new course" in the preview,
   gated to class admins (subject creation is admin-only server-side via
   `requireClassManager`). The course is created first, then its slots save
   with the batch; a duplicate name within the preview reuses the
   already-created course.
3. Do we want `TGL MULAI/SELESAI` stored later (needs a migration for
   semester range on `class_schedule`), or dropped permanently?
4. Image/photo uploads (jpg, scanned PDF): add a real OCR provider later
   (local Tesseract vs cloud vision — cloud needs an API key and explicit
   owner approval per the secrets/data rules). The parser and preview do
   not change either way.

## 10. Suggested implementation order

1. Parser + matcher + unit tests (no UI).
2. Import endpoint returning parsed rows for preview only (no writes).
3. Preview UI in the Schedule sidebar, confirm via existing single-row
   POST (option A).
4. Batch endpoint (option B) + atomicity.
5. Image OCR provider, if wanted (separate decision).
