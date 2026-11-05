"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { AttendanceRecap } from "@/lib/attendance/meeting-types";
import {
  SHEET_CELL_CLASSES,
  SHEET_CODES,
  SHEET_LABELS,
  SHEET_STATUSES,
  sheetPercentage,
  sheetTotals,
  type SheetLocale,
} from "@/lib/attendance/sheet-codes";
import type { AttendanceMeetingCellStatus } from "@starstask/contracts";

const TIME_ZONE = "Asia/Jakarta";
const SHEET_REASON = "Recorded from the attendance sheet";
const dateLabel = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  timeZone: TIME_ZONE,
});

type SheetProps = {
  classSlug: string;
  courseId?: string;
  recap: AttendanceRecap;
  componentGrades?: Record<string, number>;
  courseName: string;
  courseCode: string | null;
  className: string;
  semester: string;
  academicYear: string;
  locale?: SheetLocale;
};

type CellKey = `${string}:${string}`;

type GradeCellKey = `${string}:${string}:${string}`;

const GRADE_COMPONENTS = [
  { id: "tugas", label: "Tugas" },
  { id: "uts", label: "UTS" },
  { id: "uas", label: "UAS" },
] as const;

type GradeComponent = (typeof GRADE_COMPONENTS)[number]["id"];

/**
 * Spreadsheet-style attendance sheet for one course.
 *
 * Cells are text codes (✓ I S A T), never icons. Editing goes through the
 * audited correction endpoint, so the server re-checks manager rights and the
 * physical-verification rule for present marks. Totals use the reference
 * formula (present / total meetings); the stored values stay standardized.
 */
export function AttendanceSheet({
  classSlug,
  courseId,
  recap,
  componentGrades = {},
  courseName,
  courseCode,
  className,
  semester,
  academicYear,
  locale = "id",
}: SheetProps) {
  const router = useRouter();
  const { toast } = useToast();
  const labels = SHEET_LABELS[locale];
  const [cells, setCells] = React.useState<Record<CellKey, string>>(() =>
    Object.fromEntries(
      recap.students.flatMap((student) =>
        Object.entries(student.cells).map(
          ([sessionId, status]) =>
            [`${sessionId}:${student.userId}`, status] as const,
        ),
      ),
    ),
  );
  const [openCell, setOpenCell] = React.useState<CellKey | null>(null);
  const [pendingStatus, setPendingStatus] =
    React.useState<(typeof SHEET_STATUSES)[number]>("present");
  const [physicallyVerified, setPhysicallyVerified] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [grades, setGrades] =
    React.useState<Record<string, number>>(componentGrades);
  const [openGradeCell, setOpenGradeCell] = React.useState<GradeCellKey | null>(
    null,
  );
  const [gradeInput, setGradeInput] = React.useState("");

  const totalMeetings = recap.meetings.length;
  const percentages = recap.students.map((student) =>
    sheetPercentage(
      sheetTotals(
        Object.fromEntries(
          recap.meetings.map((meeting) => [
            meeting.sessionId,
            cells[`${meeting.sessionId}:${student.userId}`] ??
              student.cells[meeting.sessionId] ??
              "not_recorded",
          ]),
        ) as Record<string, AttendanceMeetingCellStatus>,
      ).present,
      totalMeetings,
    ),
  );
  const presentPercentages = percentages.filter(
    (value): value is number => value !== null,
  );
  const average =
    presentPercentages.length === 0
      ? null
      : presentPercentages.reduce((sum, value) => sum + value, 0) /
        presentPercentages.length;

  const openEditor = (key: CellKey, status: AttendanceMeetingCellStatus) => {
    setError(null);
    setPendingStatus(
      SHEET_STATUSES.includes(status as (typeof SHEET_STATUSES)[number])
        ? (status as (typeof SHEET_STATUSES)[number])
        : "present",
    );
    setPhysicallyVerified(false);
    setOpenCell((current) => (current === key ? null : key));
  };

  const saveCell = async (
    sessionId: string,
    userId: string,
    studentName: string,
  ) => {
    if (saving) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/classes/${classSlug}/attendance/meetings/${sessionId}/corrections`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            status: pendingStatus,
            reason: SHEET_REASON,
            physicallyVerified,
          }),
        },
      );
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        setError(body?.error?.message ?? "Could not record attendance.");
        return;
      }

      setCells((current) => ({
        ...current,
        [`${sessionId}:${userId}`]: pendingStatus,
      }));
      setOpenCell(null);
      toast({
        variant: "success",
        title: `${studentName}: ${labels[pendingStatus]}`,
      });
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const saveGrade = async (
    studentId: string,
    studentName: string,
    component: GradeComponent,
  ) => {
    if (saving || !courseId) {
      return;
    }

    const score = Number(gradeInput);

    if (!Number.isFinite(score) || score < 0 || score > 100) {
      setError("Score must be between 0 and 100.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/classes/${classSlug}/courses/${courseId}/grades`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId, component, score }),
        },
      );
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        setError(body?.error?.message ?? "Could not save the grade.");
        return;
      }

      setGrades((current) => ({
        ...current,
        [`${studentId}:${component}`]: score,
      }));
      setOpenGradeCell(null);
      toast({
        variant: "success",
        title: `${studentName}: ${component.toUpperCase()} ${score}`,
      });
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const markAllPresent = async (sessionId: string, meetingNumber: number) => {
    if (saving) {
      return;
    }

    const targets = recap.students.filter(
      (student) => student.cells[sessionId] !== "not_applicable",
    );

    if (targets.length === 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      for (const student of targets) {
        const response = await fetch(
          `/api/classes/${classSlug}/attendance/meetings/${sessionId}/corrections`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: student.userId,
              status: "present",
              reason: SHEET_REASON,
              physicallyVerified: true,
            }),
          },
        );

        if (!response.ok) {
          throw new Error("bulk");
        }
      }

      setCells((current) => {
        const next = { ...current };

        for (const student of targets) {
          next[`${sessionId}:${student.userId}`] = "present";
        }

        return next;
      });
      toast({
        variant: "success",
        title: `Meeting ${meetingNumber}: ${targets.length} marked present`,
      });
      router.refresh();
    } catch {
      setError("Could not mark the whole meeting. Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (recap.students.length === 0) {
    return (
      <section aria-label="Attendance sheet">
        <p className="text-muted-foreground border-border rounded-xl border border-dashed px-5 py-10 text-center text-sm">
          No students enrolled in this course yet.
        </p>
      </section>
    );
  }

  if (recap.meetings.length === 0) {
    return (
      <section aria-label="Attendance sheet">
        <p className="text-muted-foreground border-border rounded-xl border border-dashed px-5 py-10 text-center text-sm">
          No meetings yet. Create the first meeting to start the sheet.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Attendance sheet">
      <header className="border-border bg-surface rounded-xl border px-4 py-4 sm:px-5">
        <p className="text-xs font-medium tracking-[0.08em] uppercase">
          StarsTask — Absensi Mata Kuliah
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold tracking-tight">
              {courseName}
            </h3>
            <dl className="text-muted-foreground mt-1 space-y-0.5 text-sm">
              <div className="flex gap-2">
                <dt className="w-16 shrink-0">Kelas</dt>
                <dd>: {courseCode ?? className}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-16 shrink-0">Semester</dt>
                <dd>: {[semester, academicYear].filter(Boolean).join(" ")}</dd>
              </div>
            </dl>
          </div>
          <dl className="flex flex-wrap gap-6 text-sm">
            <div>
              <dt className="text-muted-foreground text-xs">
                Jumlah Mahasiswa
              </dt>
              <dd className="text-2xl font-semibold">
                {recap.students.length}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Total Pertemuan</dt>
              <dd className="text-2xl font-semibold">{totalMeetings}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">
                Rata-rata Kehadiran
              </dt>
              <dd className="text-2xl font-semibold text-green-700 dark:text-green-400">
                {average === null
                  ? "—"
                  : `${average.toFixed(1).replace(".", ",")}%`}
              </dd>
            </div>
          </dl>
        </div>
      </header>

      {error ? (
        <Alert
          variant="error"
          className="mt-3"
        >
          <p className="text-xs leading-relaxed">{error}</p>
        </Alert>
      ) : null}

      <div className="border-border bg-surface mt-4 overflow-x-auto overscroll-x-contain rounded-xl border">
        <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm [&_td]:border-border [&_td]:border-b [&_th]:border-border [&_th]:border-b">
          <thead>
            <tr className="bg-slate-900 text-white dark:bg-slate-950">
              <th
                scope="col"
                className="sticky left-0 z-10 w-[15rem] max-w-[62vw] bg-slate-900 px-3 py-2 dark:bg-slate-950"
              >
                <span className="flex items-center gap-3 text-left text-xs font-medium">
                  <span className="w-6 shrink-0">No.</span>
                  <span className="w-24 shrink-0">NIM</span>
                  <span className="min-w-0 flex-1 truncate">
                    Nama Mahasiswa
                  </span>
                </span>
              </th>
              <th
                colSpan={totalMeetings}
                className="px-3 py-2 text-center text-xs font-medium"
              >
                Pertemuan
              </th>
              <th
                colSpan={GRADE_COMPONENTS.length}
                className="px-3 py-2 text-center text-xs font-medium"
              >
                Nilai
              </th>
              <th className="px-2 py-2 text-center text-xs font-medium">H</th>
              <th className="px-2 py-2 text-center text-xs font-medium">I</th>
              <th className="px-2 py-2 text-center text-xs font-medium">S</th>
              <th className="px-2 py-2 text-center text-xs font-medium">A</th>
              <th className="px-2 py-2 text-center text-xs font-medium">T</th>
              <th className="px-2 py-2 text-center text-xs font-medium">%</th>
            </tr>
            <tr className="bg-slate-900 text-white dark:bg-slate-950">
              <th
                scope="col"
                className="sticky left-0 z-10 bg-slate-900 dark:bg-slate-950"
              />
              {recap.meetings.map((meeting) => (
                <th
                  key={meeting.sessionId}
                  className="w-10 px-1 py-1.5 text-center text-xs font-medium"
                  title={`Meeting ${meeting.meetingNumber} — mark all present`}
                >
                  <span className="block whitespace-nowrap">
                    {meeting.meetingNumber}
                  </span>
                  <span className="text-slate-300 block text-[10px] font-normal whitespace-nowrap">
                    {dateLabel.format(new Date(meeting.startsAt))}
                  </span>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      void markAllPresent(
                        meeting.sessionId,
                        meeting.meetingNumber,
                      )
                    }
                    className="mt-0.5 text-[10px] text-slate-300 underline underline-offset-2 hover:text-white disabled:opacity-50"
                  >
                    All ✓
                  </button>
                </th>
              ))}
              {GRADE_COMPONENTS.map((component) => (
                <th
                  key={component.id}
                  className="w-14 px-1 py-1.5 text-center text-xs font-medium"
                >
                  {component.label}
                </th>
              ))}
              <th className="bg-slate-900 dark:bg-slate-950" />
              <th className="bg-slate-900 dark:bg-slate-950" />
              <th className="bg-slate-900 dark:bg-slate-950" />
              <th className="bg-slate-900 dark:bg-slate-950" />
              <th className="bg-slate-900 dark:bg-slate-950" />
              <th className="bg-slate-900 dark:bg-slate-950" />
            </tr>
          </thead>
          <tbody>
            {recap.students.map((student, index) => {
              const rowCells = Object.fromEntries(
                recap.meetings.map((meeting) => [
                  meeting.sessionId,
                  (cells[`${meeting.sessionId}:${student.userId}`] ??
                    student.cells[meeting.sessionId] ??
                    "not_recorded") as AttendanceMeetingCellStatus,
                ]),
              ) as Record<string, AttendanceMeetingCellStatus>;
              const totals = sheetTotals(rowCells);
              const percentage = sheetPercentage(totals.present, totalMeetings);

              return (
                <tr key={student.userId}>
                  <td className="bg-surface sticky left-0 z-[5] w-[15rem] max-w-[62vw] border-r border-border px-3 py-2 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)]">
                    <span className="flex items-center gap-3 text-xs">
                      <span className="text-muted-foreground w-6 shrink-0 text-center tabular-nums">
                        {index + 1}
                      </span>
                      <span className="w-24 shrink-0 tabular-nums">
                        {student.nim ?? "—"}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {student.fullName}
                      </span>
                    </span>
                  </td>
                  {recap.meetings.map((meeting) => {
                    const status =
                      rowCells[meeting.sessionId] ?? "not_recorded";
                    const key =
                      `${meeting.sessionId}:${student.userId}` as CellKey;
                    const editable = status !== "not_applicable";
                    const code =
                      status in SHEET_CODES
                        ? SHEET_CODES[status as keyof typeof SHEET_CODES]
                        : "";

                    return (
                      <td
                        key={meeting.sessionId}
                        className="relative px-1 py-1 text-center"
                      >
                        <button
                          type="button"
                          disabled={!editable || saving}
                          onClick={() => openEditor(key, status)}
                          aria-label={`${student.fullName}, meeting ${meeting.meetingNumber}`}
                          className={`inline-flex h-7 w-7 items-center justify-center rounded text-xs font-semibold ${
                            status in SHEET_CELL_CLASSES
                              ? SHEET_CELL_CLASSES[
                                  status as keyof typeof SHEET_CELL_CLASSES
                                ]
                              : "text-muted-foreground hover:bg-muted"
                          } disabled:cursor-default`}
                        >
                          {code}
                        </button>
                        {openCell === key ? (
                          <span className="border-border bg-surface absolute top-8 left-1/2 z-20 w-44 -translate-x-1/2 rounded-lg border p-2 text-left shadow-lg">
                            <span className="block space-y-1">
                              {SHEET_STATUSES.map((option) => (
                                <button
                                  key={option}
                                  type="button"
                                  onClick={() => setPendingStatus(option)}
                                  className={`flex w-full items-center gap-2 rounded px-2 py-1 text-xs ${
                                    pendingStatus === option
                                      ? "bg-muted font-semibold"
                                      : "hover:bg-muted"
                                  }`}
                                >
                                  <span
                                    className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${SHEET_CELL_CLASSES[option]}`}
                                  >
                                    {SHEET_CODES[option]}
                                  </span>
                                  {labels[option]}
                                </button>
                              ))}
                            </span>
                            {pendingStatus === "present" ? (
                              <label className="mt-2 flex items-start gap-1.5 text-[11px]">
                                <input
                                  type="checkbox"
                                  checked={physicallyVerified}
                                  onChange={(event) =>
                                    setPhysicallyVerified(event.target.checked)
                                  }
                                  className="mt-0.5"
                                />
                                I physically verified this student is present.
                              </label>
                            ) : null}
                            <span className="mt-2 flex gap-1">
                              <Button
                                size="sm"
                                disabled={
                                  saving ||
                                  (pendingStatus === "present" &&
                                    !physicallyVerified)
                                }
                                onClick={() =>
                                  void saveCell(
                                    meeting.sessionId,
                                    student.userId,
                                    student.fullName,
                                  )
                                }
                              >
                                {saving ? (
                                  <Loader2
                                    aria-hidden="true"
                                    className="h-3 w-3 animate-spin"
                                  />
                                ) : (
                                  "Save"
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setOpenCell(null)}
                              >
                                Cancel
                              </Button>
                            </span>
                          </span>
                        ) : null}
                      </td>
                    );
                  })}
                  {GRADE_COMPONENTS.map((component) => {
                    const gradeKey =
                      `${student.userId}:${component.id}` as GradeCellKey;
                    const grade = grades[`${student.userId}:${component.id}`];
                    const isOpen = openGradeCell === gradeKey;

                    return (
                      <td
                        key={component.id}
                        className="relative w-14 px-1 py-1 text-center"
                      >
                        <button
                          type="button"
                          disabled={!courseId || saving}
                          onClick={() => {
                            setError(null);
                            setGradeInput(
                              grade === undefined ? "" : String(grade),
                            );
                            setOpenGradeCell(isOpen ? null : gradeKey);
                          }}
                          aria-label={`${student.fullName}, ${component.label}`}
                          className="inline-flex h-7 min-w-7 items-center justify-center rounded px-1 text-xs font-semibold tabular-nums hover:bg-muted disabled:cursor-default"
                        >
                          {grade === undefined
                            ? "—"
                            : Number.isInteger(grade)
                              ? String(grade)
                              : grade.toFixed(1)}
                        </button>
                        {isOpen ? (
                          <span className="border-border bg-surface absolute top-8 left-1/2 z-20 w-40 -translate-x-1/2 rounded-lg border p-2 text-left shadow-lg">
                            <span className="block space-y-1">
                              <input
                                type="number"
                                inputMode="decimal"
                                min={0}
                                max={100}
                                step="0.5"
                                value={gradeInput}
                                onChange={(event) =>
                                  setGradeInput(event.target.value)
                                }
                                placeholder="0–100"
                                aria-label={`${component.label} score`}
                                className="border-input w-full rounded-md border px-2 py-1.5 text-xs tabular-nums"
                              />
                            </span>
                            <span className="mt-2 flex gap-1">
                              <Button
                                size="sm"
                                disabled={saving}
                                onClick={() =>
                                  void saveGrade(
                                    student.userId,
                                    student.fullName,
                                    component.id,
                                  )
                                }
                              >
                                {saving ? (
                                  <Loader2
                                    aria-hidden="true"
                                    className="h-3 w-3 animate-spin"
                                  />
                                ) : (
                                  "Save"
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setOpenGradeCell(null)}
                              >
                                Cancel
                              </Button>
                            </span>
                          </span>
                        ) : null}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-center text-xs">
                    {totals.present}
                  </td>
                  <td className="px-2 py-2 text-center text-xs">
                    {totals.excused}
                  </td>
                  <td className="px-2 py-2 text-center text-xs">
                    {totals.sick}
                  </td>
                  <td className="px-2 py-2 text-center text-xs">
                    {totals.absent}
                  </td>
                  <td className="px-2 py-2 text-center text-xs">
                    {totals.late}
                  </td>
                  <td className="bg-green-50 px-2 py-2 text-center text-xs font-semibold text-green-700 dark:bg-green-950 dark:text-green-300">
                    {percentage === null
                      ? "—"
                      : `${percentage.toFixed(1).replace(".", ",")}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <footer className="mt-4 flex flex-wrap gap-4 text-xs">
        <div>
          <p className="font-medium">Keterangan Kode Absen:</p>
          <ul className="mt-1.5 flex flex-wrap gap-3">
            {SHEET_STATUSES.map((status) => (
              <li
                key={status}
                className="flex items-center gap-1.5"
              >
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${SHEET_CELL_CLASSES[status]}`}
                >
                  {SHEET_CODES[status]}
                </span>
                = {labels[status]}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-muted-foreground">
          Catatan: H = Hadir, I = Izin, S = Sakit, A = Alfa, T = Terlambat.
          Persentase = (H / Total Pertemuan) × 100%.
        </p>
      </footer>
    </section>
  );
}
