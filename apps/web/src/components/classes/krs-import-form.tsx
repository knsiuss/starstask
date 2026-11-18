"use client";

import { ArrowRight, Loader2, Plus, RotateCcw } from "lucide-react";
import Link from "next/link";

import { KrsClassIdentityFields } from "@/components/classes/krs-class-identity-fields";
import { KrsCourseRow } from "@/components/classes/krs-course-row";
import { KrsUploadZone } from "@/components/classes/krs-upload-zone";
import { useKrsImport } from "@/components/classes/use-krs-import";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Import-from-KRS workflow: upload a KRS PDF or image, review and edit parsed
 * class identity, courses, and weekly schedules, then provision the class.
 */
export function KrsImportForm() {
  const state = useKrsImport();

  if (state.created) {
    return (
      <Alert
        variant="success"
        className="mt-6"
      >
        <p className="font-medium">Class {state.created.name} is ready</p>
        <p className="mt-1 text-sm">
          Added {state.created.subjectsCreated} course
          {state.created.subjectsCreated === 1 ? "" : "s"} and{" "}
          {state.created.schedulesCreated} schedule entr
          {state.created.schedulesCreated === 1 ? "y" : "ies"}.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            asChild
            size="sm"
            className="min-h-[44px]"
          >
            <Link href={`/classes/${encodeURIComponent(state.created.slug)}`}>
              Open class
              <ArrowRight
                aria-hidden="true"
                className="h-4 w-4"
              />
            </Link>
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={state.resetAll}
            className="min-h-[44px]"
          >
            <RotateCcw
              aria-hidden="true"
              className="h-4 w-4"
            />
            Import another KRS
          </Button>
        </div>
      </Alert>
    );
  }

  return (
    <div className="mt-6 space-y-5">
      <KrsUploadZone
        isParsing={state.isParsing}
        hasParsed={state.hasParsed}
        fileName={state.fileName}
        onFileSelected={(file) => void state.handleFile(file)}
        onManualEntry={state.startManual}
      />

      {state.parseError ? (
        <Alert
          variant="error"
          role="alert"
        >
          <p>{state.parseError}</p>
          <p className="mt-1 text-xs">
            If your PDF is a scan without selectable text, upload a clear PNG or
            JPG screenshot of your KRS instead.
          </p>
        </Alert>
      ) : null}

      {state.warnings.length > 0 ? (
        <Alert variant="warning">
          <ul className="list-disc space-y-1 pl-4 text-xs">
            {state.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {state.hasParsed ? (
        <form
          className="space-y-5"
          onSubmit={state.submit}
        >
          <KrsClassIdentityFields
            classCode={state.classCode}
            semesterNumber={state.semesterNumber}
            academicYear={state.academicYear}
            fieldErrors={state.fieldErrors}
            onClassCodeChange={state.setClassCode}
            onSemesterChange={state.setSemesterNumber}
            onAcademicYearChange={state.setAcademicYear}
          />

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-foreground text-sm font-medium">
                Courses ({state.courses.length})
              </h2>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={state.addCourse}
                className="min-h-[44px]"
              >
                <Plus
                  aria-hidden="true"
                  className="h-4 w-4"
                />
                Add course
              </Button>
            </div>

            {state.courses.length === 0 ? (
              <Alert variant="info">
                <p className="text-sm">
                  No courses listed yet. Add at least one course to continue.
                </p>
              </Alert>
            ) : (
              <div className="space-y-3">
                {state.courses.map((course, index) => (
                  <KrsCourseRow
                    key={course.key}
                    course={course}
                    index={index}
                    onChange={state.updateCourse}
                    onRemove={state.removeCourse}
                  />
                ))}
              </div>
            )}
          </div>

          <fieldset className="space-y-2">
            <legend className="text-foreground text-sm font-medium">
              Who can join?
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="border-border bg-subtle flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-lg border p-3 text-sm">
                <input
                  type="radio"
                  name="krsJoinPolicy"
                  value="invitation"
                  checked={state.joinPolicy === "invitation"}
                  onChange={() => state.setJoinPolicy("invitation")}
                />
                <span className="font-medium">Invitation only</span>
              </label>
              <label className="border-border bg-subtle flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-lg border p-3 text-sm">
                <input
                  type="radio"
                  name="krsJoinPolicy"
                  value="open"
                  checked={state.joinPolicy === "open"}
                  onChange={() => state.setJoinPolicy("open")}
                />
                <span className="font-medium">Open with code</span>
              </label>
            </div>
          </fieldset>

          {state.submitError ? (
            <Alert
              variant="error"
              role="alert"
            >
              <p>{state.submitError.message}</p>
              {state.submitError.code === "slug_taken" ? (
                <p className="mt-2">
                  <Link
                    href="/classes/join"
                    className="font-medium underline"
                  >
                    Go to Join a class
                  </Link>
                </p>
              ) : null}
            </Alert>
          ) : null}

          <Button
            type="submit"
            disabled={state.isSubmitting || state.courses.length === 0}
            className="h-11 min-h-[44px] w-full"
          >
            {state.isSubmitting ? (
              <Loader2
                aria-hidden="true"
                className="h-4 w-4 animate-spin"
              />
            ) : null}
            {state.isSubmitting
              ? "Importing class..."
              : `Create class & import ${state.courses.length} course${state.courses.length === 1 ? "" : "s"}`}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
