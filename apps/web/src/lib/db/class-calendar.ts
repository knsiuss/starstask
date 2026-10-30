import "server-only";

import { getSiteUrl } from "@/lib/env/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DataAccessError } from "@/lib/db/assignments";
import { getClassBySlug } from "@/lib/db/classes";
import type { IcsEvent } from "@starstask/shared";

export type ClassCalendarFeed = {
  slug: string;
  name: string;
  courseName: string;
  events: IcsEvent[];
};

const CALENDAR_EVENT_LIMIT = 500;

/** Calendar feed for a signed-in reader of one active class. */
export async function getClassCalendarFeed(
  slug: string,
): Promise<ClassCalendarFeed | null> {
  const found = await getClassBySlug(slug);

  if (!found || found.status !== "active") {
    return null;
  }

  const siteUrl = getSiteUrl();
  const supabase = await createSupabaseServerClient();

  const [assignmentsResult, sessionsResult] = await Promise.all([
    supabase
      .from("assignments")
      .select("id, title, deadline, updated_at")
      .eq("class_id", found.id)
      .eq("status", "published")
      .not("deadline", "is", null)
      .order("deadline", { ascending: true })
      .limit(CALENDAR_EVENT_LIMIT),
    supabase
      .from("discussion_sessions")
      .select(
        "id, title, description, starts_at, ends_at, location, meeting_url, updated_at",
      )
      .eq("class_id", found.id)
      .eq("status", "scheduled")
      .eq("visibility", "public")
      .order("starts_at", { ascending: true })
      .limit(CALENDAR_EVENT_LIMIT),
  ]);

  if (assignmentsResult.error) {
    throw new DataAccessError(
      "Could not load class deadlines",
      assignmentsResult.error.code,
    );
  }

  if (sessionsResult.error) {
    throw new DataAccessError(
      "Could not load class sessions",
      sessionsResult.error.code,
    );
  }

  const assignmentEvents: IcsEvent[] = (assignmentsResult.data ?? []).flatMap(
    (row) => {
      if (!row.deadline) {
        return [];
      }

      const url = `${siteUrl}/assignments/${row.id}`;

      return [
        {
          uid: `assignment-${row.id}@starstask`,
          title: row.title,
          description: `Assignment deadline for ${found.name}.\n${url}`,
          url,
          startsAt: row.deadline,
          endsAt: new Date(
            Date.parse(row.deadline) + 30 * 60 * 1_000,
          ).toISOString(),
          updatedAt: row.updated_at,
        },
      ];
    },
  );

  const sessionEvents: IcsEvent[] = (sessionsResult.data ?? []).flatMap(
    (row) => {
      const url = `${siteUrl}/sessions/${row.id}`;
      const location = row.meeting_url ?? row.location ?? null;
      const details = [row.description.trim(), url]
        .filter(Boolean)
        .join("\n\n");

      return [
        {
          uid: `session-${row.id}@starstask`,
          title: row.title,
          description: details,
          url,
          location,
          startsAt: row.starts_at,
          endsAt: row.ends_at,
          updatedAt: row.updated_at,
        },
      ];
    },
  );

  return {
    slug: found.slug,
    name: found.name,
    courseName: found.course_name,
    events: [...assignmentEvents, ...sessionEvents].sort((left, right) =>
      left.startsAt.localeCompare(right.startsAt),
    ),
  };
}
