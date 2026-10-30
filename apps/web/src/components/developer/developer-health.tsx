import { Database, HardDrive, ShieldCheck } from "lucide-react";

import { formatDate } from "@starstask/shared";

import { Badge } from "@/components/ui/badge";
import type { DeveloperHealth } from "@/lib/db/developer";

function StatusRow({
  label,
  description,
  ok,
  latencyMs,
  icon: Icon,
}: {
  label: string;
  description: string;
  ok: boolean;
  latencyMs: number | null;
  icon: typeof Database;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <Icon
          aria-hidden="true"
          className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0"
        />
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {latencyMs !== null ? (
          <span className="text-muted-foreground text-xs tabular-nums">
            {latencyMs} ms
          </span>
        ) : null}
        <Badge variant={ok ? "success" : "danger"}>
          {ok ? "Reachable" : "Unavailable"}
        </Badge>
      </div>
    </div>
  );
}

export function DeveloperHealthPanel({ health }: { health: DeveloperHealth }) {
  return (
    <section
      aria-labelledby="system-health"
      className="border-border bg-surface mt-6 rounded-xl border"
    >
      <div className="border-border border-b px-4 py-3">
        <h2
          id="system-health"
          className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight"
        >
          <ShieldCheck
            aria-hidden="true"
            className="h-4 w-4"
          />
          System health
        </h2>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Reachability probes only. No environment values, credentials, or
          bucket names are shown.
        </p>
      </div>

      <div className="divide-border divide-y">
        <StatusRow
          label="Application"
          description="This dashboard rendered a request through the running app."
          ok
          latencyMs={null}
          icon={ShieldCheck}
        />
        <StatusRow
          label="Database"
          description="A read-only query against the account table."
          ok={health.database.ok}
          latencyMs={health.database.latencyMs}
          icon={Database}
        />
        <StatusRow
          label="Object storage"
          description="A metadata lookup for the attachment bucket."
          ok={health.storage.ok}
          latencyMs={health.storage.latencyMs}
          icon={HardDrive}
        />
      </div>

      <div className="border-border grid gap-3 border-t px-4 py-3 sm:grid-cols-2">
        <div>
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            Server errors · 24h
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {health.errorsLast24h.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            Auth callback failures · 24h
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {health.authFailuresLast24h.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="border-border border-t px-4 py-3">
        <h3 className="text-sm font-medium">Recent server errors</h3>
        {health.recentErrors.length === 0 ? (
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            No server errors recorded. Error capture starts when this feature is
            deployed; earlier errors live only in platform logs.
          </p>
        ) : (
          <ul className="divide-border mt-2 divide-y">
            {health.recentErrors.map((error) => (
              <li
                key={error.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">
                    {error.routePath ?? "Unattributed route"}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {[error.method, error.errorName]
                      .filter((value): value is string => Boolean(value))
                      .join(" · ") || "No error identity"}
                  </p>
                </div>
                <time
                  dateTime={error.createdAt}
                  className="text-muted-foreground text-xs"
                >
                  {formatDate(error.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
