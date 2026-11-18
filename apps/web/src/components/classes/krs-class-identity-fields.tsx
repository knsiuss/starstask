"use client";

import * as React from "react";

import { buildCanonicalClassIdentity } from "@starstask/contracts";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

const SEMESTERS = Array.from({ length: 14 }, (_, index) => index + 1);

type KrsClassIdentityFieldsProps = {
  classCode: string;
  semesterNumber: number;
  academicYear: string;
  fieldErrors: Record<string, string>;
  onClassCodeChange: (value: string) => void;
  onSemesterChange: (value: number) => void;
  onAcademicYearChange: (value: string) => void;
};

/**
 * Editable class identity fields (`classCode`, `semesterNumber`, `academicYear`)
 * with live canonical class ID preview (`05TPLM002-24/25`).
 */
export function KrsClassIdentityFields({
  classCode,
  semesterNumber,
  academicYear,
  fieldErrors,
  onClassCodeChange,
  onSemesterChange,
  onAcademicYearChange,
}: KrsClassIdentityFieldsProps) {
  const preview = React.useMemo(() => {
    const code = classCode.trim().toUpperCase();
    const yearValid = /^\d{4}\/\d{4}$/.test(academicYear.trim());
    if (!/^[A-Z0-9]{2,20}$/.test(code) || !yearValid) return null;
    return buildCanonicalClassIdentity({
      classCode: code,
      semesterNumber,
      academicYear,
    });
  }, [academicYear, classCode, semesterNumber]);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="krs-code">Class code</Label>
          <Input
            id="krs-code"
            value={classCode}
            onChange={(event) =>
              onClassCodeChange(event.target.value.toUpperCase())
            }
            placeholder="TPLM002"
            maxLength={20}
            autoCapitalize="characters"
            aria-invalid={Boolean(fieldErrors.classCode)}
            className="h-11 uppercase"
          />
          {fieldErrors.classCode ? (
            <p className="text-danger text-xs">{fieldErrors.classCode}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="krs-semester">Semester</Label>
          <Select
            id="krs-semester"
            value={String(semesterNumber)}
            onChange={(event) => onSemesterChange(Number(event.target.value))}
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
        </div>

        <div className="space-y-2">
          <Label htmlFor="krs-year">Academic year</Label>
          <Input
            id="krs-year"
            value={academicYear}
            onChange={(event) => onAcademicYearChange(event.target.value)}
            placeholder="2024/2025"
            maxLength={9}
            inputMode="numeric"
            aria-invalid={Boolean(fieldErrors.academicYear)}
            className="h-11"
          />
          {fieldErrors.academicYear ? (
            <p className="text-danger text-xs">{fieldErrors.academicYear}</p>
          ) : null}
        </div>
      </div>

      <div className="border-border bg-subtle rounded-lg border px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-muted-foreground text-xs font-medium">
            Generated class ID
          </span>
          <span className="text-foreground font-mono text-sm font-semibold">
            {preview ? preview.name : "05TPLM002-24/25"}
          </span>
        </div>
        <p className="text-muted-foreground mt-1 text-xs">
          {preview
            ? `URL code: ${preview.slug}. Existing classes you manage will receive any new courses.`
            : "Enter a class code and academic year to preview the class ID."}
        </p>
      </div>
    </>
  );
}
