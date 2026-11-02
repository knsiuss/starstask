"use client";

import { Camera, ImagePlus, Loader2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import * as React from "react";

import { PROFILE_AVATAR_MAX_BYTES } from "@starstask/contracts";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

const ACCEPTED_TYPES = ["image/png", "image/jpeg"];
const MAX_MEGABYTES = Math.round(PROFILE_AVATAR_MAX_BYTES / (1024 * 1024));

function initialsFor(displayName: string): string {
  const initials = displayName
    .split(" ")
    .map((part) => part.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return initials || "?";
}

type ProfileAvatarDialogProps = {
  avatarUrl: string | null;
  displayName: string;
};

/**
 * The profile photo and its replacement flow.
 *
 * A chosen file is previewed before anything is uploaded, and the server still
 * validates the bytes, so the preview is convenience rather than trust.
 */
export function ProfileAvatarDialog({
  avatarUrl,
  displayName,
}: ProfileAvatarDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);
  const [photo, setPhoto] = React.useState<File | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const previewUrl = React.useMemo(
    () => (photo ? URL.createObjectURL(photo) : null),
    [photo],
  );

  React.useEffect(() => {
    if (!previewUrl) {
      return;
    }

    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const shownPhoto = previewUrl ?? avatarUrl;
  const initials = initialsFor(displayName);

  const clearSelection = () => {
    setPhoto(null);
    setError(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const choosePhoto = (file: File | null) => {
    setError(null);

    if (!file) {
      setPhoto(null);
      return;
    }

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setPhoto(null);
      setError("Choose a PNG or JPG image.");
      return;
    }

    if (file.size > PROFILE_AVATAR_MAX_BYTES) {
      setPhoto(null);
      setError(`The photo must be ${MAX_MEGABYTES} MB or smaller.`);
      return;
    }

    setPhoto(file);
  };

  const uploadPhoto = async () => {
    if (!photo || isUploading) {
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const body = new FormData();
      body.set("avatar", photo);

      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        body,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;

        setError(payload?.error?.message ?? "Could not save the photo.");
        return;
      }

      clearSelection();
      setIsOpen(false);
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (isUploading) {
      return;
    }

    setIsOpen(next);

    if (!next) {
      clearSelection();
    }
  };

  return (
    <div className="relative shrink-0">
      <span className="border-border bg-muted relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border">
        {shownPhoto ? (
          <Image
            src={shownPhoto}
            alt=""
            width={160}
            height={160}
            unoptimized
            className="h-20 w-20 object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="text-muted-foreground text-xl font-semibold"
          >
            {initials}
          </span>
        )}
      </span>

      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Change profile photo"
        className="border-border bg-surface text-foreground hover:bg-muted focus-visible:outline-accent absolute -right-1 -bottom-1 flex h-7 w-7 items-center justify-center rounded-full border shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <Camera
          aria-hidden="true"
          className="h-3.5 w-3.5"
        />
      </button>

      <Dialog
        open={isOpen}
        onOpenChange={handleOpenChange}
      >
        <DialogContent>
          <DialogTitle>Profile photo</DialogTitle>
          <DialogDescription>
            PNG or JPG, up to {MAX_MEGABYTES} MB. The new photo replaces your
            current one.
          </DialogDescription>

          <div className="mt-5 flex justify-center">
            <span className="border-border bg-muted flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border">
              {shownPhoto ? (
                <Image
                  src={shownPhoto}
                  alt=""
                  width={256}
                  height={256}
                  unoptimized
                  className="h-32 w-32 object-cover"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="text-muted-foreground text-3xl font-semibold"
                >
                  {initials}
                </span>
              )}
            </span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="sr-only"
            onChange={(event) => choosePhoto(event.target.files?.[0] ?? null)}
          />

          {error ? (
            <Alert
              variant="error"
              className="mt-4"
            >
              {error}
            </Alert>
          ) : null}

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <ImagePlus
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
              {photo ? "Choose another" : "Choose image"}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void uploadPhoto()}
              disabled={!photo || isUploading}
              aria-busy={isUploading}
            >
              {isUploading ? (
                <Loader2
                  aria-hidden="true"
                  className="h-3.5 w-3.5 animate-spin"
                />
              ) : null}
              {isUploading ? "Saving..." : "Save photo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
