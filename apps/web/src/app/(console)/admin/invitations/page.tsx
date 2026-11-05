import type { Metadata } from "next";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { InviteRevokeButton } from "@/components/admin/invite-revoke-button";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { listCourseInviteTokens } from "@/lib/db/course-invites";
import { isSupabaseConfigured } from "@/lib/env/public";
import { formatDate } from "@starstask/shared";

export const metadata: Metadata = {
  title: "Course invites",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminCourseInvitesPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  await requirePlatformAdmin("/admin/invitations");

  let tokens: Awaited<ReturnType<typeof listCourseInviteTokens>> | null = null;

  try {
    tokens = await listCourseInviteTokens();
  } catch {
    console.error("[admin] course invite list load failed");
  }

  return (
    <div>
      <AdminPageHeader
        title="Course invites"
        description="Read-only registry of course invitation tokens. The invite usage policy (single-use, max uses, expiry defaults) is unresolved, so tokens cannot be created or redeemed here â€” they can only be listed or revoked. Token hashes are never displayed."
      />

      <Alert
        variant="info"
        className="mt-5"
      >
        Invite creation and redemption stay disabled until Product publishes the
        usage policy. Revoking only invalidates an active token.
      </Alert>

      {!tokens ? (
        <Alert
          variant="error"
          className="mt-5"
        >
          The invite list could not be loaded.
        </Alert>
      ) : tokens.length === 0 ? (
        <div className="mt-5">
          <AdminEmptyState
            title="No invites yet"
            description="When a platform operator issues a course invite, it will appear here."
          />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-left text-xs">
                <th className="py-2 pr-4">Created</th>
                <th className="py-2 pr-4">Offering</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Uses</th>
                <th className="py-2 pr-4">Expires</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((token) => (
                <tr
                  key={token.id}
                  className="border-border border-t align-top"
                >
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {formatDate(token.createdAt)}
                  </td>
                  <td className="text-muted-foreground py-2 pr-4 font-mono text-xs break-all">
                    {token.offeringId}
                  </td>
                  <td className="py-2 pr-4">
                    <Badge
                      variant={token.status === "active" ? "accent" : "neutral"}
                    >
                      {token.status}
                    </Badge>
                  </td>
                  <td className="py-2 pr-4">
                    {token.useCount}
                    {token.maxUses !== null ? ` / ${token.maxUses}` : " / âˆž"}
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {token.expiresAt ? formatDate(token.expiresAt) : "never"}
                  </td>
                  <td className="py-2">
                    <InviteRevokeButton
                      tokenId={token.id}
                      disabled={token.status !== "active"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
