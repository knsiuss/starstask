"use client";

import { CheckCircle2, Link2, Loader2, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  classJoinByNameSchema,
  type ClassJoinResult,
} from "@starstask/contracts";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";

type JoinMode = "name" | "link";

type JoinClassFormProps = {
  /** Value echoed back after a failed invitation-link submit. */
  submittedLink: string;
  showInvalidLink: boolean;
};

type JoinResponse = {
  data?: { result?: ClassJoinResult };
  error?: { message?: string; fields?: Record<string, string> };
};

const TABS: Array<{ mode: JoinMode; label: string }> = [
  { mode: "name", label: "Class name" },
  { mode: "link", label: "Invitation link" },
];

/**
 * Two ways in, one rule: membership only.
 *
 * "Class name" calls `join_class_by_name`, which refuses classes that require
 * an invitation. "Invitation link" stays a plain GET form so the server keeps
 * owning token extraction and the `/invite/[token]` hand-off — there is no
 * second invitation path to keep in sync.
 */
export function JoinClassForm({
  submittedLink,
  showInvalidLink,
}: JoinClassFormProps) {
  const router = useRouter();

  const [mode, setMode] = React.useState<JoinMode>("name");
  const [className, setClassName] = React.useState("");
  const [isBusy, setIsBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldError, setFieldError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<ClassJoinResult | null>(null);

  const join = async (value: string) => {
    if (isBusy) {
      return;
    }

    setError(null);
    setFieldError(null);
    setResult(null);

    const parsed = classJoinByNameSchema.safeParse({ className: value });

    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Enter a class name.");
      return;
    }

    setIsBusy(true);

    try {
      const response = await fetch("/api/classes/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await response
        .json()
        .catch(() => null)) as JoinResponse | null;

      if (!response.ok) {
        setFieldError(body?.error?.fields?.className ?? null);
        setError(body?.error?.message ?? "Could not check that class name.");
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
                setFieldError(null);
                setResult(null);
              }}
              className={cn(
                "focus-visible:outline-accent flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-[background-color,color,box-shadow] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2",
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

      {mode === "name" ? (
        <form
          className="mt-5 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            void join(className);
          }}
        >
          <Label htmlFor="class-name">Class name or code</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="class-name"
              name="className"
              value={className}
              onChange={(event) => {
                setClassName(event.target.value);
                setFieldError(null);
                setResult(null);
              }}
              placeholder="TPLM002"
              maxLength={60}
              autoComplete="off"
              aria-invalid={Boolean(fieldError)}
              aria-describedby="class-name-help"
              className="h-11 flex-1"
            />
            <Button
              type="submit"
              disabled={isBusy}
              className="h-11 shrink-0"
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
              {isBusy ? "Checking..." : "Continue"}
            </Button>
          </div>
          {fieldError ? (
            <p className="text-danger text-xs">{fieldError}</p>
          ) : (
            <p
              id="class-name-help"
              className="text-muted-foreground text-xs"
            >
              Works for classes that accept open joining. Classes that require
              an invitation will ask you for the link instead.
            </p>
          )}
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
            className="h-11"
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
            setClassName(slug);
            void join(slug);
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

function JoinResultPanel({
  result,
  onPickCandidate,
  onUseLink,
}: {
  result: ClassJoinResult;
  onPickCandidate: (slug: string) => void;
  onUseLink: () => void;
}) {
  if (result.status === "joined" || result.status === "already_member") {
    const joined = result.status === "joined";

    return (
      <div className="message-in mt-4">
        <Alert variant="success">
          <p className="inline-flex items-center gap-1.5 font-medium">
            <CheckCircle2
              aria-hidden="true"
              className="h-4 w-4"
            />
            {joined
              ? `You joined ${result.name}`
              : `You are already in ${result.name}`}
          </p>
          <p className="mt-1">
            <Link
              href={`/app/classes/${result.slug}`}
              className="text-accent font-medium hover:underline"
            >
              Open the class
            </Link>
          </p>
        </Alert>
      </div>
    );
  }

  if (result.status === "blocked_by_policy") {
    return (
      <div className="message-in mt-4">
        <Alert variant="warning">
          <p className="font-medium">{result.name} requires an invitation</p>
          <p className="mt-1">
            This class does not accept joining by name. Ask a class admin for an
            invitation link, then paste it in the{" "}
            <button
              type="button"
              onClick={onUseLink}
              className="font-medium underline underline-offset-4"
            >
              Invitation link
            </button>{" "}
            tab.
          </p>
        </Alert>
      </div>
    );
  }

  if (result.status === "ambiguous") {
    return (
      <div className="message-in mt-4">
        <Alert variant="info">
          <p className="font-medium">More than one class matches</p>
          <p className="mt-1">Pick the one you are enrolled in.</p>
          <ul className="mt-2 space-y-1">
            {result.candidates.map((candidate) => (
              <li key={candidate.id}>
                <button
                  type="button"
                  onClick={() => onPickCandidate(candidate.slug)}
                  className="text-accent text-sm font-medium underline-offset-4 hover:underline"
                >
                  {candidate.name}
                </button>
              </li>
            ))}
          </ul>
        </Alert>
      </div>
    );
  }

  return (
    <div className="message-in mt-4">
      <Alert variant="error">
        <p className="font-medium">No class found</p>
        <p className="mt-1">
          Check the spelling, or ask a class admin for an invitation link.
        </p>
      </Alert>
    </div>
  );
}
