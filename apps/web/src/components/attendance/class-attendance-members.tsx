import { Badge } from "@/components/ui/badge";
import type { ClassAttendanceMember } from "@/lib/db/class-attendance";
import { formatAttendancePercentage, formatDate } from "@starstask/shared";

export function ClassAttendanceMembers({
  members,
}: {
  members: ClassAttendanceMember[];
}) {
  if (members.length === 0) {
    return (
      <div className="border-border bg-subtle rounded-lg border border-dashed px-5 py-8 text-center text-sm">
        No members have joined this class yet.
      </div>
    );
  }

  return (
    <div className="border-border bg-surface overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-border text-muted-foreground border-b text-left text-xs">
            <th className="px-4 py-2 font-medium">Member</th>
            <th className="px-3 py-2 text-right font-medium">Present</th>
            <th className="px-3 py-2 text-right font-medium">Late</th>
            <th className="px-3 py-2 text-right font-medium">Excused</th>
            <th className="px-3 py-2 text-right font-medium">Absent</th>
            <th className="px-3 py-2 text-right font-medium">Not recorded</th>
            <th className="px-4 py-2 text-right font-medium">Attendance</th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {members.map((member) => (
            <tr key={member.userId}>
              <td className="px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium">{member.displayName}</span>
                  {member.isAdmin ? (
                    <Badge variant="accent">Class admin</Badge>
                  ) : null}
                </div>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Joined {formatDate(member.joinedAt)}
                </p>
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {member.counts.present}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {member.counts.late}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {member.counts.excused}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {member.counts.absent}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {member.counts.unrecorded}
              </td>
              <td className="px-4 py-2.5 text-right">
                <p className="font-semibold tabular-nums">
                  {formatAttendancePercentage(member.counts.percentage)}
                </p>
                <p className="text-muted-foreground text-[11px] tabular-nums">
                  {member.counts.attended}/{member.counts.eligible} attended
                </p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
