"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type AnnouncementFormProps = {
  classSlug: string;
  offerings: Array<{ id: string; courseName: string }>;
};

/** Create form for class announcements (publish or draft). */
export function AnnouncementForm({
  classSlug,
  offerings,
}: AnnouncementFormProps) {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [offeringId, setOfferingId] = React.useState("");
  const [pinned, setPinned] = React.useState(false);
  const [publish, setPublish] = React.useState(true);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/classes/${classSlug}/academic/announcements`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            body,
            offeringId: offeringId || undefined,
            pinned,
            publish,
          }),
        },
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(
          payload?.error?.message ?? "Could not post the announcement.",
        );
      }

      setTitle("");
      setBody("");
      setOfferingId("");
      setPinned(false);
      setPublish(true);
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
      <div>
        <Label htmlFor="announcement-title">Title</Label>
        <Input
          id="announcement-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          maxLength={200}
        />
      </div>
      <div>
        <Label htmlFor="announcement-body">Body</Label>
        <Textarea
          id="announcement-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          required
          maxLength={20000}
          rows={4}
        />
      </div>

      {offerings.length > 0 ? (
        <div>
          <Label htmlFor="announcement-offering">Offering (optional)</Label>
          <select
            id="announcement-offering"
            className="border-border bg-background mt-1 w-full rounded-lg border px-2 py-2 text-sm"
            value={offeringId}
            onChange={(event) => setOfferingId(event.target.value)}
          >
            <option value="">Whole class</option>
            {offerings.map((offering) => (
              <option
                key={offering.id}
                value={offering.id}
              >
                {offering.courseName}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={pinned}
            onChange={(event) => setPinned(event.target.checked)}
          />
          Pin to top
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="publish-mode"
            checked={publish}
            onChange={() => setPublish(true)}
          />
          Publish now
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="publish-mode"
            checked={!publish}
            onChange={() => setPublish(false)}
          />
          Save as draft
        </label>
      </div>

      {error ? <p className="text-danger text-sm">{error}</p> : null}

      <Button
        type="submit"
        variant="primary"
        disabled={pending}
      >
        {pending ? "Posting…" : publish ? "Publish announcement" : "Save draft"}
      </Button>
    </form>
  );
}
