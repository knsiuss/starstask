import { BookOpenCheck, ShieldCheck } from "lucide-react";

import { StatusBadge } from "@/components/classes/status-badge";
import { Badge } from "@/components/ui/badge";
import type { ClassSummary } from "@/lib/db/classes";
import { pluralize } from "@starstask/shared";

type Props = {
  classSummary: ClassSummary;
  memberCount: number;
  roleLabel: string;
  hasElevatedRole: boolean;
};

/**
 * Class identity banner: class code as the title, status and role badges,
 * and the academic meta line. A quiet inline SVG study motif sits on the
 * right without consuming vertical space.
 */
export function ClassIdentityHeader({
  classSummary,
  memberCount,
  roleLabel,
  hasElevatedRole,
}: Props) {
  return (
    <header className="border-border bg-surface relative overflow-hidden rounded-xl border">
      {/* Subtle academic motif: soft waves plus books/laptop/plant shapes. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 640 160"
        preserveAspectRatio="xMaxYMid slice"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-70"
      >
        <path
          d="M330 160c60-52 150-70 240-34 26 10 48 22 70 34z"
          fill="var(--color-band)"
        />
        <path
          d="M260 160c80-66 200-88 320-44 24 9 42 20 60 32v12H260z"
          fill="var(--color-accent-soft)"
          opacity="0.55"
        />
        <g
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect
            x="430"
            y="52"
            width="96"
            height="62"
            rx="6"
            fill="var(--color-surface)"
            stroke="var(--color-accent)"
          />
          <path
            d="M440 114h76"
            stroke="var(--color-accent-soft)"
          />
          <path
            d="M455 68h46"
            stroke="var(--color-accent)"
            strokeWidth="3"
            opacity="0.5"
          />
          <path
            d="M455 80h32"
            stroke="var(--color-accent)"
            strokeWidth="3"
            opacity="0.35"
          />
          <path
            d="M478 34v18"
            opacity="0.6"
          />
          <rect
            x="370"
            y="96"
            width="46"
            height="10"
            rx="2"
            fill="var(--color-accent)"
            stroke="none"
            opacity="0.55"
          />
          <rect
            x="376"
            y="84"
            width="40"
            height="10"
            rx="2"
            fill="var(--color-accent)"
            stroke="none"
            opacity="0.35"
          />
          <path
            d="M570 116c0-16 24-16 24 0"
            fill="var(--color-surface)"
          />
          <path
            d="M582 116V88"
            opacity="0.5"
          />
          <path
            d="M582 88c-8-2-12-8-12-16 8 2 12 8 12 16zm0 0c8-2 12-8 12-16-8 2-12 8-12 16z"
            fill="var(--color-success)"
            stroke="none"
            opacity="0.6"
          />
          <path d="M570 116h24" />
        </g>
      </svg>

      <div className="relative flex flex-wrap items-center gap-4 px-5 py-5 sm:px-6">
        <span
          aria-hidden="true"
          className="bg-accent-soft text-accent flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
        >
          <BookOpenCheck className="h-7 w-7" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight break-words sm:text-3xl">
              {classSummary.class_code ?? classSummary.name}
            </h1>
            <StatusBadge status={classSummary.status} />
            <Badge variant={hasElevatedRole ? "accent" : "neutral"}>
              {hasElevatedRole ? (
                <ShieldCheck
                  aria-hidden="true"
                  className="h-3 w-3"
                />
              ) : null}
              {roleLabel}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="text-foreground font-medium">
              {classSummary.course_name}
            </span>
            <MetaDot />
            <span>
              {classSummary.semester} {classSummary.academic_year}
            </span>
            <MetaDot />
            <span>
              {memberCount} {pluralize(memberCount, "member")}
            </span>
            {classSummary.lecturer_name ? (
              <>
                <MetaDot />
                <span>{classSummary.lecturer_name}</span>
              </>
            ) : null}
          </p>
          {classSummary.class_code ? (
            <p className="text-muted-foreground mt-1 text-xs">
              {classSummary.name}
            </p>
          ) : null}
        </div>
      </div>
    </header>
  );
}

/** Separator between class metadata items; decorative, so hidden from readers. */
export function MetaDot() {
  return (
    <span
      aria-hidden="true"
      className="text-muted-foreground/60"
    >
      ·
    </span>
  );
}
