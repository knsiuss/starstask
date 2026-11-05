"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

type AttendancePaperImportProps = {
  classSlug: string;
  meetingId: string;
  entries: Array<{
    studentIdentityId: string;
    displayName: string | null;
    studentCode: string | null;
    currentStatus: string | null;
  }>;
};

/**
 * Paper attendance import for one meeting (MVP, manual verification).
 *
 * Flow mirrors a paper checklist (NIM rows, tick = present):
 * upload a photo for reference, tick present per student, then save
 * through the existing bulk records endpoint. Automatic OCR/OMR of
 * handwritten ticks is intentionally not claimed here — the photo is
 * only a visual reference; the ticks are entered by the class manager.
 */
export function AttendancePaperImport({
  classSlug,
  meetingId,
  entries,
}: AttendancePaperImportProps) {
  const router = useRouter();
  const [photoUrl, setPhotoUrl] = React.useState<string | null>(null);
  const [present, setPresent] = React.useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};

    for (const entry of entries) {
      initial[entry.studentIdentityId] = entry.currentStatus === "present";
    }

    return initial;
  });
  const [pending, setPending] = React.useState(false);
  const [parsing, setParsing] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function onParsePdf(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setParsing(true);
    setError(null);
    setMessage(null);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("meetingId", meetingId);

      const response = await fetch(
        `/api/classes/${classSlug}/academic/attendance/paper-parse`,
        { method: "POST", body: form },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(
          body?.error?.message ?? "PDF could not be read automatically.",
        );
      }

      const body = (await response.json()) as {
        data: {
          hits: Array<{ studentCode: string; present: boolean }>;
          warnings: string[];
        };
      };
      const byCode = new Map(
        body.data.hits.map((hit) => [hit.studentCode, hit.present]),
      );

      setPresent((current) => {
        const next = { ...current };

        for (const entry of entries) {
          if (entry.studentCode && byCode.has(entry.studentCode)) {
            next[entry.studentIdentityId] = Boolean(
              byCode.get(entry.studentCode),
            );
          }
        }

        return next;
      });
      setMessage(
        body.data.warnings.length > 0
          ? (body.data.warnings[0] ?? null)
          : `Read ${body.data.hits.length} NIM(s). Verify before saving.`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unexpected error.");
    } finally {
      setParsing(false);
    }
  }

  React.useEffect(
    () => () => {
      if (photoUrl) {
        URL.revokeObjectURL(photoUrl);
      }
    },
    [photoUrl],
  );

  function onPhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (photoUrl) {
      URL.revokeObjectURL(photoUrl);
    }

    setPhotoUrl(URL.createObjectURL(file));
  }

  async function onSave() {
    setPending(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/classes/${classSlug}/academic/attendance/records`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meetingId,
            entries: entries.map((entry) => ({
              studentIdentityId: entry.studentIdentityId,
              status: present[entry.studentIdentityId] ? "present" : "absent",
            })),
          }),
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(body?.error?.message ?? "Could not save import.");
      }

      setMessage("Paper attendance saved for this meeting.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unexpected error.");
    } finally {
      setPending(false);
    }
  }

  if (entries.length === 0) {
    return null;
  }

  const presentCount = entries.filter(
    (entry) => present[entry.studentIdentityId],
  ).length;

  return (
    <div className="border-border mt-6 border-t pt-6">
      <h3 className="text-sm font-semibold">Import kertas / scan</h3>
      <p className="text-muted-foreground mt-1 text-sm">
        Untuk PDF cetak (ada text layer), pakai &quot;Baca otomatis dari
        PDF&quot; — sistem mencocokkan NIM dan tanda centang per baris, lalu
        kamu verifikasi. Untuk foto/scan, pakai grid centang manual di bawah
        (foto hanya referensi).
      </p>

      <label className="mt-3 block">
        <span className="text-sm font-medium">Baca otomatis dari PDF</span>
        <input
          type="file"
          accept=".pdf"
          className="mt-1 block w-full text-sm"
          onChange={onParsePdf}
        />
      </label>
      {parsing ? (
        <p className="text-muted-foreground mt-1 text-sm">Reading…</p>
      ) : null}

      <label className="mt-3 block">
        <span className="text-sm font-medium">Foto kertas (referensi)</span>
        <input
          type="file"
          accept="image/*,.pdf"
          className="mt-1 block w-full text-sm"
          onChange={onPhotoChange}
        />
      </label>

      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- local object URL preview, no remote image
        <img
          src={photoUrl}
          alt="Foto kertas absensi sebagai referensi"
          className="mt-3 max-h-64 rounded-lg border object-contain"
        />
      ) : null}

      <p className="mt-3 text-sm">
        Hadir: <strong>{presentCount}</strong> / {entries.length}
      </p>

      <div className="mt-3 max-h-72 overflow-y-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground text-left text-xs">
              <th className="py-2 pr-4">Hadir</th>
              <th className="py-2 pr-4">Student</th>
              <th className="py-2">ID</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.studentIdentityId}
                className="border-border border-t"
              >
                <td className="py-2 pr-4">
                  <input
                    type="checkbox"
                    aria-label={`Hadir ${entry.displayName ?? entry.studentIdentityId}`}
                    checked={Boolean(present[entry.studentIdentityId])}
                    onChange={(event) =>
                      setPresent((current) => ({
                        ...current,
                        [entry.studentIdentityId]: event.target.checked,
                      }))
                    }
                  />
                </td>
                <td className="py-2 pr-4">
                  {entry.displayName ?? "Unknown member"}
                </td>
                <td className="text-muted-foreground py-2">
                  {entry.studentCode ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={onSave}
          disabled={pending}
        >
          {pending ? "Saving…" : "Save paper attendance"}
        </Button>
        {message ? <p className="text-success text-sm">{message}</p> : null}
        {error ? <p className="text-danger text-sm">{error}</p> : null}
      </div>
    </div>
  );
}
