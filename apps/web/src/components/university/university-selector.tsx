"use client";

import * as React from "react";
import { Building2, Globe, MapPin } from "lucide-react";

import type { ActiveUniversityRow } from "@/lib/db/universities";
import { cn } from "@/lib/utils/cn";

type UniversitySelectorProps = {
  universities: ActiveUniversityRow[];
  currentUniversityId?: string | null;
};

/**
 * Read-only university browser. Picking a card shows its public details and
 * the access request path; nothing is persisted and no membership is created.
 * Self-service switching is deliberately absent (decision register #7).
 */
export function UniversitySelector({
  universities,
  currentUniversityId,
}: UniversitySelectorProps) {
  const [selectedId, setSelectedId] = React.useState<string | null>(
    currentUniversityId ?? universities[0]?.id ?? null,
  );
  const selected = universities.find((row) => row.id === selectedId) ?? null;

  if (universities.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No universities are active on StarsTask yet. Once a university is
        activated by the platform, it will appear here.
      </p>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <ul className="space-y-2">
        {universities.map((university) => (
          <li key={university.id}>
            <button
              type="button"
              onClick={() => setSelectedId(university.id)}
              aria-pressed={selectedId === university.id}
              className={cn(
                "border-border flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                selectedId === university.id
                  ? "bg-accent-soft border-accent"
                  : "hover:bg-muted",
              )}
            >
              <Building2
                aria-hidden="true"
                className="text-accent h-5 w-5 shrink-0"
              />
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {university.name}
                </span>
                <span className="text-muted-foreground block text-xs">
                  {[university.city, university.country]
                    .filter(Boolean)
                    .join(", ") || university.slug}
                </span>
              </span>
              {currentUniversityId === university.id ? (
                <span className="bg-accent-soft text-accent ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold">
                  Your university
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      {selected ? (
        <div className="border-border bg-card rounded-2xl border p-5">
          <h3 className="text-lg font-semibold">{selected.name}</h3>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {selected.slug}
          </p>

          <dl className="mt-4 space-y-2 text-sm">
            {selected.type ? (
              <div className="flex gap-2">
                <dt className="text-muted-foreground w-24 shrink-0">Type</dt>
                <dd>{selected.type}</dd>
              </div>
            ) : null}
            {selected.city || selected.country ? (
              <div className="flex gap-2">
                <dt className="text-muted-foreground w-24 shrink-0">
                  Location
                </dt>
                <dd className="inline-flex items-center gap-1">
                  <MapPin
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                  />
                  {[selected.city, selected.country].filter(Boolean).join(", ")}
                </dd>
              </div>
            ) : null}
            {selected.timezone ? (
              <div className="flex gap-2">
                <dt className="text-muted-foreground w-24 shrink-0">
                  Timezone
                </dt>
                <dd>{selected.timezone}</dd>
              </div>
            ) : null}
            {selected.website ? (
              <div className="flex gap-2">
                <dt className="text-muted-foreground w-24 shrink-0">Website</dt>
                <dd>
                  <a
                    href={selected.website}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-accent inline-flex items-center gap-1 hover:underline"
                  >
                    <Globe
                      aria-hidden="true"
                      className="h-3.5 w-3.5"
                    />
                    {selected.website}
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>

          <div className="bg-muted mt-5 rounded-xl p-4 text-sm">
            <p className="font-medium">How to get access</p>
            <p className="text-muted-foreground mt-1">
              Memberships are granted by your university&apos;s operator. Ask
              them to link your account to this university; you will then see
              your academic home, units, and classes here. Selecting a
              university never creates a membership by itself.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
