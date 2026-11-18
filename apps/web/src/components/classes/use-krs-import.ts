"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import {
  krsImportConfirmSchema,
  toFieldErrors,
  type KrsCourseDraft,
  type KrsParseResponse,
} from "@starstask/contracts";

import type { CourseRow } from "@/components/classes/krs-course-row";

type ParseApiResponse = {
  data?: KrsParseResponse;
  error?: { code?: string; message?: string };
};

export type ConfirmResult = {
  classId: string;
  slug: string;
  name: string;
  subjectsCreated: number;
  schedulesCreated: number;
};

type ConfirmApiResponse = {
  data?: ConfirmResult;
  error?: { code?: string; message?: string; fields?: Record<string, string> };
};

function currentAcademicYear(): string {
  const now = new Date();
  const start = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}/${start + 1}`;
}

export function makeCourseRow(draft?: Partial<KrsCourseDraft>): CourseRow {
  return {
    key: crypto.randomUUID(),
    courseCode: draft?.courseCode ?? "",
    courseName: draft?.courseName ?? "",
    lecturerName: draft?.lecturerName ?? null,
    dayOfWeek: draft?.dayOfWeek ?? null,
    startTime: draft?.startTime ?? null,
    endTime: draft?.endTime ?? null,
    room: draft?.room ?? null,
  };
}

/**
 * State and API workflow hook for parsing a KRS document and confirming class
 * provisioning.
 */
export function useKrsImport() {
  const router = useRouter();
  const [isParsing, setIsParsing] = React.useState(false);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [warnings, setWarnings] = React.useState<string[]>([]);
  const [hasParsed, setHasParsed] = React.useState(false);
  const [fileName, setFileName] = React.useState<string | null>(null);

  const [classCode, setClassCode] = React.useState("");
  const [semesterNumber, setSemesterNumber] = React.useState(5);
  const [academicYear, setAcademicYear] = React.useState(currentAcademicYear);
  const [joinPolicy, setJoinPolicy] = React.useState<"invitation" | "open">(
    "invitation",
  );
  const [courses, setCourses] = React.useState<CourseRow[]>([]);

  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [submitError, setSubmitError] = React.useState<{
    code?: string;
    message: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [created, setCreated] = React.useState<ConfirmResult | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file || isParsing) return;

    setParseError(null);
    setSubmitError(null);
    setFieldErrors({});
    setWarnings([]);
    setFileName(file.name);
    setIsParsing(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/classes/import-krs/parse", {
        method: "POST",
        body: formData,
      });
      const body = (await response
        .json()
        .catch(() => null)) as ParseApiResponse | null;

      if (!response.ok || !body?.data) {
        setParseError(
          body?.error?.message ??
            "Could not read this KRS file. Try a text-based PDF or a clear screenshot.",
        );
        return;
      }

      const parsed = body.data;
      if (parsed.classCode) setClassCode(parsed.classCode);
      if (parsed.semesterNumber) setSemesterNumber(parsed.semesterNumber);
      if (parsed.academicYear) setAcademicYear(parsed.academicYear);

      setCourses(
        parsed.courses.length > 0
          ? parsed.courses.map((course) => makeCourseRow(course))
          : [makeCourseRow()],
      );
      setWarnings(parsed.warnings);
      setHasParsed(true);
    } catch {
      setParseError("Network error while reading your KRS. Try again.");
    } finally {
      setIsParsing(false);
    }
  };

  const updateCourse = (key: string, patch: Partial<KrsCourseDraft>) => {
    setCourses((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  };

  const removeCourse = (key: string) => {
    setCourses((current) => current.filter((row) => row.key !== key));
  };

  const addCourse = () => {
    setCourses((current) => [...current, makeCourseRow()]);
  };

  const startManual = () => {
    setCourses([makeCourseRow()]);
    setHasParsed(true);
  };

  const resetAll = () => {
    setHasParsed(false);
    setFileName(null);
    setParseError(null);
    setWarnings([]);
    setCourses([]);
    setFieldErrors({});
    setSubmitError(null);
    setCreated(null);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setFieldErrors({});
    setSubmitError(null);

    const payload = {
      classCode,
      semesterNumber,
      academicYear,
      joinPolicy,
      courses: courses.map((course) => ({
        courseCode: course.courseCode,
        courseName: course.courseName,
        lecturerName: course.lecturerName,
        dayOfWeek: course.dayOfWeek,
        startTime: course.startTime,
        endTime: course.endTime,
        room: course.room,
      })),
    };

    const parsed = krsImportConfirmSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      setSubmitError({
        message:
          "Check the highlighted fields and course rows before importing.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/classes/import-krs/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await response
        .json()
        .catch(() => null)) as ConfirmApiResponse | null;

      if (!response.ok || !body?.data) {
        setFieldErrors(body?.error?.fields ?? {});
        setSubmitError({
          code: body?.error?.code,
          message:
            body?.error?.message ?? "Could not import this class. Try again.",
        });
        return;
      }

      setCreated(body.data);
      router.refresh();
    } catch {
      setSubmitError({
        message: "Network error. Check your connection and try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    isParsing,
    parseError,
    warnings,
    hasParsed,
    fileName,
    classCode,
    setClassCode,
    semesterNumber,
    setSemesterNumber,
    academicYear,
    setAcademicYear,
    joinPolicy,
    setJoinPolicy,
    courses,
    fieldErrors,
    submitError,
    isSubmitting,
    created,
    handleFile,
    updateCourse,
    removeCourse,
    addCourse,
    startManual,
    resetAll,
    submit,
  };
}
