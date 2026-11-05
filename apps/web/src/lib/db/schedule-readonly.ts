import "server-only";

import { DataAccessError } from "@/lib/db/assignments";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Read-only projections of the new normalized schedule model
 * (`schedule_rules` / `schedule_instances` / `schedule_exceptions`).
 * The legacy `class_course_schedules` flow is untouched and stays the
 * source of truth for existing pages.
 */

export type ScheduleRuleRow = {
  id: string;
  offeringId: string;
  courseName: string;
  weekday: number;
  startTime: string;
  endTime: string;
  room: string | null;
  timezone: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
};

export type ScheduleInstanceRow = {
  id: string;
  ruleId: string;
  instanceDate: string;
  startsAt: string;
  endsAt: string;
  status: string;
};

export type ScheduleExceptionRow = {
  id: string;
  instanceId: string;
  kind: string;
  note: string | null;
  createdAt: string;
};

export type ScheduleOverview = {
  rules: ScheduleRuleRow[];
  instances: ScheduleInstanceRow[];
  exceptions: ScheduleExceptionRow[];
};

export async function listScheduleForClass(
  offeringIds: string[],
): Promise<ScheduleOverview> {
  if (offeringIds.length === 0) {
    return { rules: [], instances: [], exceptions: [] };
  }

  const supabase = await createSupabaseServerClient();
  const { data: ruleRows, error: ruleError } = await supabase
    .from("schedule_rules")
    .select(
      "id, offering_id, weekday, start_time, end_time, room, timezone, effective_from, effective_to, course_offerings!schedule_rules_offering_same_university ( courses!course_offerings_course_id_fkey ( name ) )",
    )
    .in("offering_id", offeringIds)
    .order("weekday", { ascending: true })
    .order("start_time", { ascending: true });

  if (ruleError) {
    throw new DataAccessError("Could not load schedule rules", ruleError.code);
  }

  const rawRules = (ruleRows ?? []) as unknown as Array<{
    id: string;
    offering_id: string;
    weekday: number;
    start_time: string;
    end_time: string;
    room: string | null;
    timezone: string;
    effective_from: string | null;
    effective_to: string | null;
    course_offerings: { courses: { name: string } | null } | null;
  }>;

  const rules: ScheduleRuleRow[] = rawRules.map((row) => ({
    id: row.id,
    offeringId: row.offering_id,
    courseName: row.course_offerings?.courses?.name ?? "Unknown course",
    weekday: row.weekday,
    startTime: row.start_time,
    endTime: row.end_time,
    room: row.room,
    timezone: row.timezone,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
  }));

  if (rules.length === 0) {
    return { rules, instances: [], exceptions: [] };
  }

  const ruleIds = rules.map((rule) => rule.id);
  const { data: instanceRows, error: instanceError } = await supabase
    .from("schedule_instances")
    .select("id, rule_id, instance_date, starts_at, ends_at, status")
    .in("rule_id", ruleIds)
    .order("instance_date", { ascending: false })
    .limit(200);

  if (instanceError) {
    throw new DataAccessError(
      "Could not load schedule instances",
      instanceError.code,
    );
  }

  const instances: ScheduleInstanceRow[] = (instanceRows ?? []).map((row) => ({
    id: row.id,
    ruleId: row.rule_id,
    instanceDate: row.instance_date,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
  }));

  if (instances.length === 0) {
    return { rules, instances, exceptions: [] };
  }

  const { data: exceptionRows, error: exceptionError } = await supabase
    .from("schedule_exceptions")
    .select("id, instance_id, kind, note, created_at")
    .in(
      "instance_id",
      instances.map((instance) => instance.id),
    )
    .order("created_at", { ascending: false });

  if (exceptionError) {
    throw new DataAccessError(
      "Could not load schedule exceptions",
      exceptionError.code,
    );
  }

  const exceptions: ScheduleExceptionRow[] = (exceptionRows ?? []).map(
    (row) => ({
      id: row.id,
      instanceId: row.instance_id,
      kind: row.kind,
      note: row.note,
      createdAt: row.created_at,
    }),
  );

  return { rules, instances, exceptions };
}
