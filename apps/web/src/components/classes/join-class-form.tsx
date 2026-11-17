"use client";

import { Link2, Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  buildCanonicalClassIdentity,
  classJoinOrCreateSchema,
  toFieldErrors,
} from "@starstask/contracts";

import {
  JoinResultPanel,
  type JoinOutcome,
} from "@/components/classes/join-result-panel";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils/cn";

type JoinMode = "code" | "link";

type JoinClassFormProps = {
  /** Value echoed back after a failed invitation-link submit. */
  submittedLink: string;
  showInvalidLink: boolean;
};

type JoinResponse = {
  data?: { result?: JoinOutcome };
  error?: { message?: string; fields?: Record<string, string> };
};

const SEMESTERS = Array.from({ length: 14 }, (_, index) => index + 1);

const TABS: Array<{ mode: JoinMode; label: string }> = [
  { mode: "code", label: "Class code" },
  { mode: "link", label: "Invitation link" },
];

function currentAcademicYear(): string {
  const now = new Date();
  const start = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}/${start + 1}`;
}

/**
 * Two ways in, one rule: membership only.
 *
 * "Class code" joins an existing canonical class (`05TPLM002-24/25`) or
 * auto-creates it if nobody has created it yet, preventing duplicate collisions.
 * "Invitation link" stays a plain GET form so the server owns `/invite/[token]`.
 */
export function JoinClassForm({
  submittedLink,
  showInvalidLink,
}: JoinClassFormProps) {
  const router = useRouter();

  const [mode, setMode] = React.useState<JoinMode>("code");
  const [classCode, setClassCode] = React.useState("");
  const [semesterNumber, setSemesterNumber] = React.useState(5);
  const [academicYear, setAcademicYear] = React.useState(currentAcademicYear);
  const [isBusy, setIsBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [result, setResult] = React.useState<JoinOutcome | null>(null);

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

  const submitStructured = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isBusy) {
      return;
    }

    setError(null);
    setFieldErrors({});
    setResult(null);

    const parsed = classJoinOrCreateSchema.safeParse({
      classCode,
      semesterNumber,
      academicYear,
    });

    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }

    await postJoin(parsed.data);
  };

  const postJoin = async (
    payload:
      | { classCode: string; semesterNumber: number; academicYear: string }
      | { className: string },
  ) => {
    setIsBusy(true);

    try {
      const response = await fetch("/api/classes/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response
        .json()
        .catch(() => null)) as JoinResponse | null;

      if (!response.ok) {
        setFieldErrors(body?.error?.fields ?? {});
        setError(body?.error?.message ?? "Could not check that class.");
        return;
      }

      const next = body?.data?.result ?? null;

      setResult(next);

      if (next?.status === "joined") {
        router.refresh();
      }
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label="How to join"
        className="border-border bg-subtle mt-6 flex gap-1 rounded-lg border p-1"
      >
        {TABS.map((tab) => {
          const isActive = mode === tab.mode;

          return (
            <button
              key={tab.mode}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setMode(tab.mode);
                setError(null);
                setFieldErrors({});
                setResult(null);
              }}
              className={cn(
                "focus-visible:outline-accent min-h-[40px] flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-[background-color,color,box-shadow] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2",
                isActive
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {mode === "code" ? (
        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            void submitStructured(event);
          }}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="join-code">Class code</Label>
              <Input
                id="join-code"
                value={classCode}
                onChange={(event) => {
                  setClassCode(event.target.value.toUpperCase());
                  setFieldErrors({});
                  setResult(null);
                }}
                placeholder="TPLM002"
                maxLength={20}
                autoCapitalize="characters"
                autoComplete="off"
                aria-invalid={Boolean(fieldErrors.classCode)}
                className="h-11 uppercase"
              />
              {fieldErrors.classCode ? (
                <p className="text-danger text-xs">{fieldErrors.classCode}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="join-semester">Semester</Label>
              <Select
                id="join-semester"
                value={String(semesterNumber)}
                onChange={(event) => {
                  setSemesterNumber(Number(event.target.value));
                  setResult(null);
                }}
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

            <div className="space-y-1.5">
              <Label htmlFor="join-year">Academic year</Label>
              <Input
                id="join-year"
                value={academicYear}
                onChange={(event) => {
                  setAcademicYear(event.target.value);
                  setFieldErrors({});
                  setResult(null);
                }}
                placeholder="2024/2025"
                maxLength={9}
                inputMode="numeric"
                aria-invalid={Boolean(fieldErrors.academicYear)}
                className="h-11"
              />
              {fieldErrors.academicYear ? (
                <p className="text-danger text-xs">
                  {fieldErrors.academicYear}
                </p>
              ) : null}
            </div>
          </div>

          <div className="border-border bg-subtle rounded-lg border px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground text-xs font-medium">
                Class ID
              </span>
              <span className="text-foreground font-mono text-sm font-semibold">
                {preview ? preview.name : "05TPLM002-24/25"}
              </span>
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              Joins this class if it already exists, or creates it automatically
              for your cohort if nobody has set it up yet.
            </p>
          </div>

          <Button
            type="submit"
            disabled={isBusy}
            className="h-11 w-full"
          >
            {isBusy ? (
              <Loader2
                aria-hidden="true"
                className="h-4 w-4 animate-spin"
              />
            ) : (
              <Search
                aria-hidden="true"
                className="h-4 w-4"
              />
            )}
            {isBusy ? "Checking..." : "Join or create class"}
          </Button>
        </form>
      ) : (
        <form
          method="get"
          action="/classes/join"
          className="mt-5 space-y-2"
        >
          <Label htmlFor="invitation">Invitation link</Label>
          <Input
            id="invitation"
            name="invitation"
            type="text"
            required
            defaultValue={submittedLink}
            placeholder="https://starstask.app/invite/..."
            aria-invalid={showInvalidLink}
            className="h-11"
          />
          <p className="text-muted-foreground text-xs">
            The link must be opened with the same Google account the admin
            invited.
          </p>
          <Button
            type="submit"
            className="h-11 w-full sm:w-auto"
          >
            <Link2
              aria-hidden="true"
              className="h-4 w-4"
            />
            Continue
          </Button>
        </form>
      )}

      {error ? (
        <Alert
          variant="error"
          className="message-in mt-4"
        >
          {error}
        </Alert>
      ) : null}

      {result ? (
        <JoinResultPanel
          result={result}
          onPickCandidate={(slug) => {
            void postJoin({ className: slug });
          }}
          onUseLink={() => {
            setMode("link");
            setResult(null);
          }}
        />
      ) : null}
    </div>
  );
}
