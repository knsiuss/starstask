"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CLASS_ADMIN_PERMISSION_CODES,
  type ClassAdminPermissionCode,
} from "@starstask/contracts";

type GrantAdminFormProps = {
  classSlug: string;
};

/**
 * Grants class admin permissions to a user. Exactly one target identifier is
 * required; permission codes are the schema's eight fixed codes (no presets
 * or groups exist yet).
 */
export function GrantAdminForm({ classSlug }: GrantAdminFormProps) {
  const router = useRouter();
  const [targetType, setTargetType] = React.useState<
    "userId" | "studentIdentityId"
  >("userId");
  const [targetValue, setTargetValue] = React.useState("");
  const [codes, setCodes] = React.useState<ClassAdminPermissionCode[]>([
    "manage_attendance",
  ]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function toggleCode(code: ClassAdminPermissionCode) {
    setCodes((current) =>
      current.includes(code)
        ? current.filter((entry) => entry !== code)
        : [...current, code],
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/classes/${classSlug}/academic/admins`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            [targetType]: targetValue.trim(),
            permissionCodes: codes,
          }),
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(
          body?.error?.message ?? "Could not grant the admin role.",
        );
      }

      setTargetValue("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unexpected error.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3"
    >
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="target-type"
            checked={targetType === "userId"}
            onChange={() => setTargetType("userId")}
          />
          Account ID
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="target-type"
            checked={targetType === "studentIdentityId"}
            onChange={() => setTargetType("studentIdentityId")}
          />
          Student identity ID
        </label>
      </div>

      <div>
        <Label htmlFor="grant-target">
          {targetType === "userId" ? "User ID" : "Student identity ID"}
        </Label>
        <Input
          id="grant-target"
          value={targetValue}
          onChange={(event) => setTargetValue(event.target.value)}
          placeholder="UUID"
          required
        />
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Permissions</legend>
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {CLASS_ADMIN_PERMISSION_CODES.map((code) => (
            <label
              key={code}
              className="hover:bg-muted flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm"
            >
              <input
                type="checkbox"
                checked={codes.includes(code)}
                onChange={() => toggleCode(code)}
              />
              {code}
            </label>
          ))}
        </div>
      </fieldset>

      {error ? <p className="text-danger text-sm">{error}</p> : null}

      <Button
        type="submit"
        variant="primary"
        disabled={pending || codes.length === 0}
      >
        {pending ? "Granting…" : "Grant admin"}
      </Button>
    </form>
  );
}
