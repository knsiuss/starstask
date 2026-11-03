"use client";

import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  classInvitationCreateSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { InvitationLinkToast } from "@/components/classes/invitation-link-toast";
import {
  InvitationList,
  type InvitationListItem,
} from "@/components/classes/invitation-list";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

type InvitationManagerProps = {
  classSlug: string;
  initialInvitations: InvitationListItem[];
};

type CreatedInvitation = {
  id: string;
  invitePath: string;
  expiresAt: string;
  maxUses: number;
  emailRestriction: string | null;
};

/**
 * Creates and revokes invitation links.
 *
 * The raw token is returned once and kept only in the success toast, so the
 * link cannot be recovered after it is dismissed. The database stores a hash.
 */
export function InvitationManager({
  classSlug,
  initialInvitations,
}: InvitationManagerProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [invitations, setInvitations] =
    React.useState<InvitationListItem[]>(initialInvitations);
  const [expiresInDays, setExpiresInDays] = React.useState("7");
  const [maxUses, setMaxUses] = React.useState("1");
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [isBusy, setIsBusy] = React.useState(false);
  const [revokingId, setRevokingId] = React.useState<string | null>(null);

  const create = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isBusy) {
      return;
    }

    setError(null);
    setFieldErrors({});

    const parsed = classInvitationCreateSchema.safeParse({
      expiresInDays,
      maxUses,
      email: email || undefined,
    });

    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      setError("Check the invitation settings.");
      return;
    }

    setIsBusy(true);

    try {
      const response = await fetch(`/api/classes/${classSlug}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const body = (await response.json().catch(() => null)) as {
        data?: CreatedInvitation;
        error?: { message?: string; fieldErrors?: Record<string, string> };
      } | null;

      if (!response.ok || !body?.data) {
        setFieldErrors(body?.error?.fieldErrors ?? {});
        setError(body?.error?.message ?? "Could not create the invitation.");
        return;
      }

      const created = body.data;

      setInvitations((current) => [
        {
          id: created.id,
          email_restriction: created.emailRestriction,
          expires_at: created.expiresAt,
          max_uses: created.maxUses,
          used_count: 0,
          revoked_at: null,
          created_at: new Date().toISOString(),
        },
        ...current,
      ]);
      setEmail("");

      // The link cannot be recovered, so this toast waits for the user.
      toast({
        title: "Invite link ready",
        description:
          "Copy it now. For security the link is shown only once and cannot be recovered.",
        variant: "success",
        duration: 0,
        content: (
          <InvitationLinkToast
            url={`${window.location.origin}${created.invitePath}`}
            emailRestriction={created.emailRestriction}
          />
        ),
      });
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setIsBusy(false);
    }
  };

  const revoke = async (invitationId: string) => {
    if (revokingId) {
      return;
    }

    setRevokingId(invitationId);

    try {
      const response = await fetch(
        `/api/classes/${classSlug}/invitations/${invitationId}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;

        toast({
          title: "Could not revoke invitation",
          description: body?.error?.message ?? "Please try again.",
          variant: "error",
        });
        return;
      }

      setInvitations((current) =>
        current.map((invitation) =>
          invitation.id === invitationId
            ? { ...invitation, revoked_at: new Date().toISOString() }
            : invitation,
        ),
      );
      toast({
        title: "Invitation revoked",
        description: "The link can no longer be used to join.",
        variant: "success",
      });
      router.refresh();
    } catch {
      toast({
        title: "Could not revoke invitation",
        description: "Network error. Check your connection and try again.",
        variant: "error",
      });
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <section
        aria-labelledby="share-invite"
        className="border-border bg-surface rounded-2xl border p-5"
      >
        <h2
          id="share-invite"
          className="text-base font-semibold tracking-tight"
        >
          Share class invite
        </h2>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Anyone with an active link can join as a student.
        </p>

        {error ? (
          <Alert
            variant="error"
            className="mt-3"
          >
            {error}
          </Alert>
        ) : null}

        <form
          onSubmit={create}
          noValidate
          className="mt-4 space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="invite-days">Expires in</Label>
              <Select
                id="invite-days"
                value={expiresInDays}
                onChange={(event) => setExpiresInDays(event.target.value)}
                aria-invalid={Boolean(fieldErrors.expiresInDays)}
              >
                <option value="1">1 day</option>
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
              </Select>
              <FieldError message={fieldErrors.expiresInDays} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-uses">Uses</Label>
              <Input
                id="invite-uses"
                type="number"
                min={1}
                max={500}
                value={maxUses}
                onChange={(event) => setMaxUses(event.target.value)}
                aria-invalid={Boolean(fieldErrors.maxUses)}
              />
              <FieldError message={fieldErrors.maxUses} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email (optional)</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Restrict to one email"
                maxLength={254}
                aria-invalid={Boolean(fieldErrors.email)}
              />
              <FieldError message={fieldErrors.email} />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground text-xs">
              Links grant membership only, never an admin role.
            </p>
            <Button
              type="submit"
              disabled={isBusy}
              className="w-full sm:w-auto"
            >
              {isBusy ? (
                <Loader2
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin"
                />
              ) : (
                <Plus
                  aria-hidden="true"
                  className="h-4 w-4"
                />
              )}
              {isBusy ? "Creating…" : "Create link"}
            </Button>
          </div>
        </form>
      </section>

      <section
        aria-labelledby="manage-invites-list"
        className="border-border bg-surface rounded-2xl border p-5"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="manage-invites-list"
            className="text-base font-semibold tracking-tight"
          >
            Invitations
          </h2>
          <span className="text-muted-foreground text-xs tabular-nums">
            {invitations.length} total
          </span>
        </div>

        <div className="mt-4">
          <InvitationList
            invitations={invitations}
            revokingId={revokingId}
            onRevoke={(invitationId) => void revoke(invitationId)}
          />
        </div>
      </section>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-danger text-xs">{message}</p>;
}
