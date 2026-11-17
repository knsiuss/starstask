"use client";

import Link from "next/link";
import * as React from "react";

import type { ExportBrandingInput } from "@starstask/contracts";

/**
 * Compact template preview shown above the export buttons.
 *
 * Fetched best-effort: the export card works identically when the branding
 * endpoint is unavailable, so a failure hides this box silently.
 */
export function BrandingPreview({ classSlug }: { classSlug: string }) {
  const [branding, setBranding] = React.useState<ExportBrandingInput | null>(
    null,
  );

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(
          `/api/classes/${encodeURIComponent(classSlug)}/branding`,
        );

        if (!response.ok) {
          return;
        }

        const body = (await response.json()) as {
          data?: { branding?: ExportBrandingInput };
        };

        if (!cancelled && body.data?.branding) {
          setBranding(body.data.branding);
        }
      } catch {
        // Best-effort preview; the export itself is unaffected.
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [classSlug]);

  if (!branding) {
    return null;
  }

  const lines = [
    branding.universityName,
    branding.faculty,
    branding.studyProgram,
  ].filter(Boolean);

  return (
    <div className="border-border bg-surface mt-3 rounded-lg border p-3">
      <p className="text-xs font-semibold">Template preview</p>
      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
        {lines.length > 0 ? lines.join(" · ") : "No institution set yet"} ·{" "}
        {branding.productName}
      </p>
      <Link
        href={`/settings/branding?class=${encodeURIComponent(classSlug)}`}
        className="text-accent mt-1 inline-block text-xs font-medium underline-offset-4 hover:underline"
      >
        Ubah di Settings →
      </Link>
    </div>
  );
}
