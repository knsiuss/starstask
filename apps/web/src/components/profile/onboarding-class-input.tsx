"use client";

import * as React from "react";

import { buildCanonicalClassIdentity } from "@starstask/contracts";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

const SEMESTERS = Array.from({ length: 14 }, (_, index) => index + 1);

function currentAcademicYear(): string {
  const now = new Date();
  const start = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}/${start + 1}`;
}

type OnboardingClassInputProps = {
  error?: string;
  onChange: (canonicalClassName: string) => void;
};

/**
 * Optional structured class input for onboarding.
 *
 * When `classCode` is filled, composes `05TPLM002-24/25` so the server can
 * auto-join or auto-create that exact cohort class during profile save.
 */
export function OnboardingClassInput({
  error,
  onChange,
}: OnboardingClassInputProps) {
  const [classCode, setClassCode] = React.useState("");
  const [semesterNumber, setSemesterNumber] = React.useState(5);
  const [academicYear, setAcademicYear] = React.useState(currentAcademicYear);

  const preview = React.useMemo(() => {
    const code = classCode.trim().toUpperCase();
    const yearValid = /^\d{4}\/\d{4}$/.test(academicYear.trim());

    if (!/^[A-Z0-9]{2,20}$/.test(code) || !yearValid) {
      return null;
    }

    return buildCanonicalClassIdentity({
      classCode: code,
      semesterNumber,
      academicYear,
    });
  }, [academicYear, classCode, semesterNumber]);

  React.useEffect(() => {
    const cleaned = classCode.trim().toUpperCase();

    if (!cleaned) {
      onChange("");
      return;
    }

    if (preview) {
      onChange(preview.name);
      return;
    }

    onChange(cleaned);
  }, [classCode, onChange, preview]);

  return (
    <div className="space-y-2">
      <Label htmlFor="onboarding-class-code">
        Class / Kelas{" "}
        <span className="text-muted-foreground font-normal">(optional)</span>
      </Label>

      <div className="grid gap-2.5 sm:grid-cols-3">
        <Input
          id="onboarding-class-code"
          value={classCode}
          onChange={(event) => setClassCode(event.target.value.toUpperCase())}
          maxLength={20}
          autoCapitalize="characters"
          autoComplete="off"
          aria-invalid={Boolean(error)}
          placeholder="TPLM002"
          className="h-11 uppercase"
        />

        <Select
          id="onboarding-class-semester"
          aria-label="Semester"
          value={String(semesterNumber)}
          onChange={(event) => setSemesterNumber(Number(event.target.value))}
          className="h-11"
        >
          {SEMESTERS.map((semester) => (
            <option
              key={semester}
              value={semester}
            >
              Semester {semester}
            </option>
          ))}
        </Select>

        <Input
          id="onboarding-class-year"
          aria-label="Academic year"
          value={academicYear}
          onChange={(event) => setAcademicYear(event.target.value)}
          maxLength={9}
          inputMode="numeric"
          placeholder="2024/2025"
          className="h-11"
        />
      </div>

      {error ? (
        <p className="text-danger text-xs">{error}</p>
      ) : (
        <p className="text-muted-foreground text-xs">
          {preview
            ? `Class ID: ${preview.name}. Saved automatically: joins if it exists, or creates it for your cohort.`
            : "Optional. Enter your class code, semester, and academic year to auto-join or create your class right away."}
        </p>
      )}
    </div>
  );
}
