import { InvitationManager } from "@/components/classes/invitation-manager";
import { isInvitationActive } from "@/lib/classes/invitation-status";
import { listClassInvitations } from "@/lib/db/classes";

type ManageInvitesTabProps = {
  classId: string;
  classSlug: string;
};

export async function ManageInvitesTab({
  classId,
  classSlug,
}: ManageInvitesTabProps) {
  const invitations = await listClassInvitations(classId);
  const activeCount = invitations.filter((invitation) =>
    isInvitationActive(invitation),
  ).length;

  return (
    <section
      aria-labelledby="manage-invites"
      className="mt-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="manage-invites"
            className="text-lg font-semibold tracking-tight"
          >
            Invitations
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {activeCount} active · {invitations.length} total
          </p>
        </div>
      </div>

      <div className="mt-4">
        <InvitationManager
          classSlug={classSlug}
          initialInvitations={invitations}
        />
      </div>
    </section>
  );
}
