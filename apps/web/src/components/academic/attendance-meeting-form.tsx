"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type MeetingFormProps = {
  classSlug: string;
  offeringId: string;
};

/** Creates a normalized attendance meeting for one offering. */
export function AttendanceMeetingForm({
  classSlug,
  offeringId,
}: MeetingFormProps) {
  const router = useRouter();
  const [scheduledAt, setScheduledAt] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const iso = new Date(scheduledAt).toISOString();
      const response = await fetch(
        `/api/classes/${classSlug}/academic/attendance/meetings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            offeringId,
            scheduledAt: iso,
            location: location.trim() ? location.trim() : undefined,
          }),
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(
          body?.error?.message ?? "Could not create the meeting.",
        );
      }

      setScheduledAt("");
      setLocation("");
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
      className="mt-3 flex flex-wrap items-end gap-3"
    >
      <div>
        <Label htmlFor="meeting-at">Scheduled at</Label>
        <Input
          id="meeting-at"
          type="datetime-local"
          value={scheduledAt}
          onChange={(event) => setScheduledAt(event.target.value)}
          required
        />
      </div>
      <div>
        <Label htmlFor="meeting-location">Location (optional)</Label>
        <Input
          id="meeting-location"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          placeholder="Room A-301"
          maxLength={200}
        />
      </div>
      <Button
        type="submit"
        variant="primary"
        disabled={pending}
      >
        {pending ? "Creating…" : "Add meeting"}
      </Button>
      {location.trim() && scheduledAt ? (
        <p className="text-muted-foreground w-full text-xs">
          Lokasi terisi + waktu lewat = langsung open otomatis.
        </p>
      ) : null}
      {error ? <p className="text-danger w-full text-sm">{error}</p> : null}
    </form>
  );
}
