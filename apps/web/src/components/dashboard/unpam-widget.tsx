import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { PluginEvent } from "@/features/plugins/types";

/** Widget dashboard: 3 event UNPAM terdekat. Hanya dirender untuk member UNPAM. */
export function UnpamWidget({ events }: { events: PluginEvent[] }) {
  const upcoming = events
    .filter((e) => e.startsAt >= new Date().toISOString().slice(0, 10))
    .slice(0, 3);
  if (upcoming.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          University Info
          <Badge variant="neutral">UNPAM</Badge>
        </CardTitle>
      </CardHeader>
      <ul className="space-y-2 px-4 pb-4">
        {upcoming.map((e, i) => (
          <li
            key={i}
            className="text-sm"
          >
            <span className="font-medium">{e.title}</span>
            <span className="text-muted-foreground"> • {e.startsAt}</span>
          </li>
        ))}
      </ul>
      <div className="px-4 pb-4">
        <Link
          href="/university-info"
          className="text-accent text-xs underline-offset-2 hover:underline"
        >
          Lihat semua →
        </Link>
      </div>
    </Card>
  );
}
