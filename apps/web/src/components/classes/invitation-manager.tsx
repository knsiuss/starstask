"use client";

import { Copy, Loader2, PlusCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  classInvitationCreateSchema,
  toFieldErrors,
} from "@starstask/contracts";
import { formatDate } from "@starstask/shared";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export type InvitationListItem = {
  id: string;
  email_restriction: string | null;
  expires_at: string;
  max_uses: number;
  used_count: number;
  revoked_at: string | null;
  created_at: string;
};

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
        <Alert variant="success">
          <p className="font-medium">Invitation created</p>
          <p className="mt-1 text-xs">
            Copy this link now. For security it is shown only once and cannot be
            recovered later.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Input
              readOnly
              value={`${created.invitePath}`}
              aria-label="Invitation link"
              className="max-w-md bg-background"
              onFocus={(event) => event.currentTarget.select()}
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => void copyLink()}
            >
              <Copy
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          {created.emailRestriction ? (
            <p className="mt-2 text-xs">
              Only {created.emailRestriction} can accept this link.
            </p>
          ) : null}
        </Alert>
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
          <Label htmlFor="invite-email">Restrict to email</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Optional"
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

      {invitations.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No invitation links yet. Create one and share it with your class.
        </p>
      ) : (
        <ul className="divide-border border-border divide-y rounded-lg border">
          {invitations.map((invitation) => {
            const isExpired = new Date(invitation.expires_at) <= new Date();
            const isRevoked = invitation.revoked_at !== null;
            const isUsedUp = invitation.used_count >= invitation.max_uses;
            const status = isRevoked
              ? "Revoked"
              : isExpired
                ? "Expired"
                : isUsedUp
                  ? "Used up"
                  : "Active";
            const variant = status === "Active" ? "success" : "neutral";

            return (
              <li
                key={invitation.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {invitation.email_restriction ?? "Anyone with the link"}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {invitation.used_count}/{invitation.max_uses} used · expires{" "}
                    {formatDate(invitation.expires_at)} · created{" "}
                    {formatDate(invitation.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={variant}>{status}</Badge>
                  {!isRevoked ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => void revoke(invitation.id)}
                      aria-label="Revoke invitation"
                    >
                      <Trash2
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                      />
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-muted-foreground text-xs">
        Invitation links grant membership only. They never grant class admin or
        platform admin roles.
      </p>
    </div>
  );
}
