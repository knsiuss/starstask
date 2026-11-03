import { InvitationManager } from "@/components/classes/invitation-manager";
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

  return (
    <div className="mt-6">
      <InvitationManager
        classSlug={classSlug}
        initialInvitations={invitations}
      />
    </div>
  );
}
