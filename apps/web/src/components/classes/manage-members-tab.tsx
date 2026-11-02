import { MemberManager } from "@/components/classes/member-manager";
import { listClassMembers } from "@/lib/db/classes";
import { pluralize } from "@starstask/shared";

type ManageMembersTabProps = {
  classId: string;
  classSlug: string;
  currentUserId: string;
  canManageAdmins: boolean;
};

export async function ManageMembersTab({
  classId,
  classSlug,
  currentUserId,
  canManageAdmins,
}: ManageMembersTabProps) {
  const members = await listClassMembers(classId);
  const adminCount = members.filter((member) => member.is_admin).length;

  return (
    <section
      aria-labelledby="manage-members"
      className="mt-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="manage-members"
            className="text-lg font-semibold tracking-tight"
          >
            Members
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {members.length} {pluralize(members.length, "member")} ·{" "}
            {adminCount} {pluralize(adminCount, "class admin")}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <MemberManager
          classSlug={classSlug}
          members={members}
          canManageAdmins={canManageAdmins}
          currentUserId={currentUserId}
        />
      </div>
    </section>
  );
}
