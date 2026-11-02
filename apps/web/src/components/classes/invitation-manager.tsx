"use client";

import { Loader2, PlusCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  classInvitationCreateSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { CreatedInvitationAlert } from "@/components/classes/created-invitation-alert";
import type { InvitationListItem } from "@/components/classes/invitation-list";
import { InvitationList } from "@/components/classes/invitation-list";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

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
 * The raw token is returned once, kept only in this component's state, and
 * shown with a copy button. Reloading the page loses it; only the hash exists in
 * the database.
 */
export function InvitationManager({
  classSlug,
  initialInvitations,
}: InvitationManagerProps) {
  const router = useRouter();
  const [invitations, setInvitations] =
    React.useState<InvitationListItem[]>(initialInvitations);
  const [created, setCreated] = React.useState<CreatedInvitation | null>(null);
  const [expiresInDays, setExpiresInDays] = React.useState("7");
  const [maxUses, setMaxUses] = React.useState("1");
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [isBusy, setIsBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const create = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isBusy) {
      return;
    }

    setError(null);
    setFieldErrors({});
    setCreated(null);

    const parsed = classInvitationCreateSchema.safeParse({
      expiresInDays,
      maxUses,
      email: email || undefined,
    });

    if (!parsed.success) {
      const errors = toFieldErrors(parsed.error);
      setFieldErrors(errors);
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
        data?: {
          id: string;
          invitePath: string;
          expiresAt: string;
          maxUses: number;
          emailRestriction: string | null;
        };
        error?: { message?: string; fieldErrors?: Record<string, string> };
      } | null;

      if (!response.ok || !body?.data) {
        setFieldErrors(body?.error?.fieldErrors ?? {});
        setError(body?.error?.message ?? "Could not create the invitation.");
        return;
      }

      const createdInvitation = body.data;

      setCreated(createdInvitation);
      setInvitations((current) => [
        {
          id: createdInvitation.id,
          email_restriction: createdInvitation.emailRestriction,
          expires_at: createdInvitation.expiresAt,
          max_uses: createdInvitation.maxUses,
          used_count: 0,
          revoked_at: null,
          created_at: new Date().toISOString(),
        },
        ...current,
      ]);
      setCopied(false);
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setIsBusy(false);
    }
  };

  const revoke = async (invitationId: string) => {
    setError(null);

    try {
      const response = await fetch(
        `/api/classes/${classSlug}/invitations/${invitationId}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(body?.error?.message ?? "Could not revoke the invitation.");
        return;
      }

      setInvitations((current) =>
        current.map((invitation) =>
          invitation.id === invitationId
            ? { ...invitation, revoked_at: new Date().toISOString() }
            : invitation,
        ),
      );
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    }
  };

  const copyLink = async () => {
    if (!created) {
      return;
    }

    const url = `${window.location.origin}${created.invitePath}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError("Could not copy automatically. Select the link manually.");
    }
  };

  return (
    <div className="space-y-5">
      {error ? <Alert variant="error">{error}</Alert> : null}

      {created ? (
        <CreatedInvitationAlert
          invitePath={created.invitePath}
          emailRestriction={created.emailRestriction}
          copied={copied}
          onCopy={() => void copyLink()}
        />
      ) : null}

      <form
        onSubmit={create}
        noValidate
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="space-y-1.5">
          <Label htmlFor="invite-days">Expires in</Label>
          <Select
            id="invite-days"
            value={expiresInDays}
            onChange={(event) => setExpiresInDays(event.target.value)}
          >
            <option value="1">1 day</option>
            <option value="7">7 days</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
          </Select>
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
        </div>

        <div className="flex items-end">
          <Button
            type="submit"
            disabled={isBusy}
            className="w-full"
          >
            {isBusy ? (
              <Loader2
                aria-hidden="true"
                className="h-4 w-4 animate-spin"
              />
            ) : (
              <PlusCircle
                aria-hidden="true"
                className="h-4 w-4"
              />
            )}
            Create link
          </Button>
        </div>
      </form>

      <InvitationList
        invitations={invitations}
        onRevoke={(invitationId) => void revoke(invitationId)}
      />

      <p className="text-muted-foreground text-xs">
        Links grant membership only, never an admin role.
      </p>
    </div>
  );
}
