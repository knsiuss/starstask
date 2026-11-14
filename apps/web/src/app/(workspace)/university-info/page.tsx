import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { TabStrip } from "@/components/ui/tab-strip";
import { fetchUnpamEvents } from "@/features/plugins/unpam/adapter";
import type { PluginEvent } from "@/features/plugins/types";
import {
  PROGRAM_LABELS,
  type ProgramId,
  filterEventsByProgram,
  isUnpamPluginEnabled,
  parseProgramParam,
} from "@/features/plugins/unpam/config";
import { getSessionUser } from "@/lib/auth/session";
import {
  getMyProgramId,
  getPersistedUnpamEvents,
  isUnpamMember,
  searchPersistedUnpamEvents,
} from "@/lib/db/plugins";
import { getMyProfile } from "@/lib/db/profiles";
import { isSupabaseConfigured } from "@/lib/env/public";

export const metadata: Metadata = {
  title: "University Info",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{
    program?: string;
    q?: string;
    from?: string;
    to?: string;
  }>;
};

const KIND_LABELS: Record<PluginEvent["kind"], string> = {
  "academic-calendar": "Kalender",
  "e-learning": "MENTARI",
  events: "Pengumuman",
};

function SourceLink({ event }: { event: PluginEvent }) {
  if (!event.sourceUrl) {
    return null;
  }

  return (
    <Link
      href={event.sourceUrl}
      target="_blank"
      rel="noreferrer"
      className="text-accent text-xs underline-offset-2 hover:underline"
    >
      Sumber resmi
    </Link>
  );
}

export default async function UniversityInfoPage({ searchParams }: PageProps) {
  if (!isSupabaseConfigured() || !isUnpamPluginEnabled()) {
    notFound();
  }

  const session = await getSessionUser();

  const myProfile = session ? await getMyProfile().catch(() => null) : null;

  if (!(await isUnpamMember(session?.user.id ?? null, myProfile?.university))) {
    notFound();
  }

  const params = await searchParams;
  // Auto program dari academic unit bila ?program= tidak diisi (personalization).
  const autoProgram = await getMyProgramId(session?.user.id ?? null);
  const program: ProgramId =
    params.program != null ? parseProgramParam(params.program) : autoProgram;

  // DB dulu (persisted via cron), fallback live fetch. DB = offline + bisa search.
  const persisted = await getPersistedUnpamEvents();
  const searched =
    params.q || params.from || params.to
      ? await searchPersistedUnpamEvents(params.q ?? "", params.from, params.to)
      : persisted;
  const events =
    searched.length > 0
      ? searched
      : persisted.length > 0
        ? persisted
        : await fetchUnpamEvents().catch(() => []);
  const filtered = filterEventsByProgram(events, program);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-semibold">University Info</h1>
        <p className="text-muted-foreground text-sm">
          Kalender akademik, jadwal MENTARI, dan pengumuman UNPAM / FTI.
        </p>
      </header>

      <form
        method="get"
        className="flex flex-wrap gap-2"
      >
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Cari event..."
          className="border-border rounded border px-2 py-1 text-sm"
        />
        <input
          name="from"
          type="date"
          defaultValue={params.from ?? ""}
          className="border-border rounded border px-2 py-1 text-sm"
        />
        <input
          name="to"
          type="date"
          defaultValue={params.to ?? ""}
          className="border-border rounded border px-2 py-1 text-sm"
        />
        <button
          type="submit"
          className="bg-primary text-primary-foreground rounded px-3 py-1 text-sm"
        >
          Cari
        </button>
      </form>

      <TabStrip
        label="Filter program"
        items={(
          [
            ["semua", "Semua"],
            ["ti", "Teknik Informatika"],
            ["manajemen", "Manajemen"],
          ] as [ProgramId, string][]
        ).map(([id, label]) => ({
          href:
            id === "semua"
              ? "/university-info"
              : `/university-info?program=${id}`,
          label,
          active: program === id,
        }))}
      />

      <p className="text-muted-foreground text-xs">
        Menampilkan {filtered.length} dari {events.length} kegiatan
        {program !== "semua" ? ` untuk ${PROGRAM_LABELS[program]}` : ""}.
      </p>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Data kampus belum dapat dimuat saat ini.
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.slice(0, 30).map((event, index) => (
            <li
              key={`${event.sourceUrl}-${index}`}
              className="border-border bg-surface rounded-lg border p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-medium">{event.title}</p>
                <div className="flex shrink-0 gap-1">
                  <Badge variant="neutral">{KIND_LABELS[event.kind]}</Badge>
                  <Badge variant="neutral">
                    {PROGRAM_LABELS[event.programId]}
                  </Badge>
                </div>
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                {event.startsAt}
                {event.endsAt ? ` — ${event.endsAt}` : ""}
              </p>
              {event.description ? (
                <p className="text-muted-foreground mt-2 text-sm line-clamp-3">
                  {event.description}
                </p>
              ) : null}
              <div className="mt-2">
                <SourceLink event={event} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
