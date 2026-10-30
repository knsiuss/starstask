"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { PROFILE_BIO_MAX, type ProfileBioInput } from "@starstask/contracts";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ProfileBioFormProps = {
  initialBio: string;
};

type BioResponse = {
  data?: { bio?: string | null };
  error?: { message?: string };
};

export function ProfileBioForm({ initialBio }: ProfileBioFormProps) {
  const router = useRouter();
  const [bio, setBio] = React.useState(initialBio);
  const [savedBio, setSavedBio] = React.useState(initialBio);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const isDirty = bio.trim() !== savedBio.trim();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setIsSaving(true);

    const payload: ProfileBioInput = { bio: bio.trim() || null };

    try {
      const response = await fetch("/api/profile/bio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response
        .json()
        .catch(() => null)) as BioResponse | null;

      if (!response.ok) {
        setError(body?.error?.message ?? "Could not save your bio. Try again.");
        return;
      }

      const nextBio = body?.data?.bio ?? "";
      setBio(nextBio);
      setSavedBio(nextBio);
      setSaved(true);
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="space-y-3"
    >
      {error ? <Alert variant="error">{error}</Alert> : null}
      {saved ? <Alert variant="success">Bio saved.</Alert> : null}

      <div>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="profile-bio">Bio</Label>
          <span
            id="profile-bio-count"
            className="text-muted-foreground text-xs tabular-nums"
          >
            {bio.length}/{PROFILE_BIO_MAX}
          </span>
        </div>
        <Textarea
          id="profile-bio"
          name="bio"
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          maxLength={PROFILE_BIO_MAX}
          rows={5}
          aria-describedby="profile-bio-help profile-bio-count"
          placeholder="Tell your classmates a little about yourself — your interests, what you are studying, or how you prefer to be contacted."
          className="mt-1.5 min-h-32"
        />
        <p
          id="profile-bio-help"
          className="text-muted-foreground mt-1.5 text-xs leading-relaxed"
        >
          Shown to members of classes you belong to. Leave it empty to hide it.
        </p>
      </div>

      <Button
        type="submit"
        size="sm"
        disabled={isSaving || !isDirty}
      >
        {isSaving ? (
          <Loader2
            aria-hidden="true"
            className="h-3.5 w-3.5 animate-spin"
          />
        ) : null}
        {isSaving ? "Saving..." : "Save bio"}
      </Button>
    </form>
  );
}
