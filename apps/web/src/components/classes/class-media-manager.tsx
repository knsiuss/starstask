"use client";

import { ImagePlus, Loader2, Pencil, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

type MediaKind = "avatar" | "cover";

type ClassMediaManagerProps = {
  classSlug: string;
  className: string;
  initialAvatarUrl: string | null;
  initialCoverUrl: string | null;
  /** `compact` renders the trimmed card used by the management overview. */
  variant?: "full" | "compact";
};

type MediaResponse = {
  data?: { avatarUrl: string | null; coverUrl: string | null };
  error?: { message?: string };
};

/**
 * Class identity images: a cover behind the header and a square profile image.
 *
 * A chosen file is previewed locally first and only uploaded when the owner
 * saves, so an accidental pick never replaces the current image.
 */
export function ClassMediaManager({
  classSlug,
  className,
  initialAvatarUrl,
  initialCoverUrl,
  variant = "full",
}: ClassMediaManagerProps) {
  const isCompact = variant === "compact";
  const router = useRouter();

  const [avatarUrl, setAvatarUrl] = React.useState(initialAvatarUrl);
  const [coverUrl, setCoverUrl] = React.useState(initialCoverUrl);

  const [pending, setPending] = React.useState<{
    kind: MediaKind;
    file: File;
  } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const coverInputRef = React.useRef<HTMLInputElement>(null);
  const avatarInputRef = React.useRef<HTMLInputElement>(null);

  const previewUrl = React.useMemo(
    () => (pending ? URL.createObjectURL(pending.file) : null),
    [pending],
  );

  React.useEffect(() => {
    if (!previewUrl) {
      return;
    }

    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const shownCover = pending?.kind === "cover" ? previewUrl : coverUrl;
  const shownAvatar = pending?.kind === "avatar" ? previewUrl : avatarUrl;

  const pick = (kind: MediaKind, file: File | null) => {
    setError(null);

    if (!file) {
      return;
    }

    setPending({ kind, file });
  };

  const resetInputs = () => {
    if (coverInputRef.current) {
      coverInputRef.current.value = "";
    }

    if (avatarInputRef.current) {
      avatarInputRef.current.value = "";
    }
  };

  const cancel = () => {
    setPending(null);
    setError(null);
    resetInputs();
  };

  const save = async () => {
    if (!pending || busy) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const body = new FormData();
      body.set("kind", pending.kind);
      body.set("file", pending.file);

      const response = await fetch(`/api/classes/${classSlug}/media`, {
        method: "POST",
        body,
      });
      const payload = (await response
        .json()
        .catch(() => null)) as MediaResponse | null;

      if (!response.ok) {
        setError(payload?.error?.message ?? "Could not save the image.");
        return;
      }

      setAvatarUrl(payload?.data?.avatarUrl ?? null);
      setCoverUrl(payload?.data?.coverUrl ?? null);
      setPending(null);
      resetInputs();
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (kind: MediaKind) => {
    if (busy) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/classes/${classSlug}/media?kind=${kind}`,
        { method: "DELETE" },
      );
      const payload = (await response
        .json()
        .catch(() => null)) as MediaResponse | null;

      if (!response.ok) {
        setError(payload?.error?.message ?? "Could not remove the image.");
        return;
      }

      setAvatarUrl(payload?.data?.avatarUrl ?? null);
      setCoverUrl(payload?.data?.coverUrl ?? null);
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby="class-media-heading"
      className={cn(
        isCompact && "border-border bg-surface rounded-2xl border p-5",
      )}
    >
      <h2
        id="class-media-heading"
        className="text-base font-semibold tracking-tight"
      >
        {isCompact ? "Class appearance" : "Appearance"}
      </h2>
      <p className="text-muted-foreground mt-0.5 text-xs">
        {isCompact
          ? "Cover behind the header and the square profile image."
          : "PNG or JPG, up to 4 MB. The cover sits behind the class header; the profile image is the square tile."}
      </p>

      {error ? (
        <Alert
          variant="error"
          className="mt-3"
        >
          {error}
        </Alert>
      ) : null}

      {isCompact ? (
        <div className="mt-4">
          <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-3">
            <div
              className={cn(
                "border-border relative h-28 overflow-hidden rounded-xl border",
                !shownCover &&
                  "from-accent-soft via-band to-surface bg-gradient-to-br",
              )}
            >
              {shownCover ? (
                <Image
                  src={shownCover}
                  alt={`Cover of ${className}`}
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : null}
              <input
                ref={coverInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="sr-only"
                onChange={(event) =>
                  pick("cover", event.target.files?.[0] ?? null)
                }
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="bg-surface/95 absolute bottom-2 left-2"
                onClick={() => coverInputRef.current?.click()}
                disabled={busy}
              >
                <ImagePlus
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                />
                {coverUrl ? "Change cover" : "Upload cover"}
              </Button>
            </div>

            <div className="relative">
              <span className="border-border bg-muted relative flex h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-xl border">
                {shownAvatar ? (
                  <Image
                    src={shownAvatar}
                    alt=""
                    width={88}
                    height={88}
                    unoptimized
                    className="h-[88px] w-[88px] object-cover"
                  />
                ) : (
                  <ImagePlus
                    aria-hidden="true"
                    className="text-muted-foreground h-5 w-5"
                  />
                )}
              </span>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="sr-only"
                onChange={(event) =>
                  pick("avatar", event.target.files?.[0] ?? null)
                }
              />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute right-1 bottom-1 h-7 w-7 rounded-full"
                onClick={() => avatarInputRef.current?.click()}
                disabled={busy}
                aria-label={
                  avatarUrl ? "Change profile image" : "Upload profile image"
                }
              >
                <Pencil
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                />
              </Button>
            </div>
          </div>

          {coverUrl || avatarUrl ? (
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {coverUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void remove("cover")}
                  disabled={busy}
                >
                  <Trash2
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                  />
                  Remove cover
                </Button>
              ) : null}
              {avatarUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void remove("avatar")}
                  disabled={busy}
                >
                  <Trash2
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                  />
                  Remove image
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <div className="mt-4">
            <div
              className={cn(
                "border-border relative h-32 overflow-hidden rounded-xl border",
                !shownCover &&
                  "from-accent-soft via-band to-surface bg-gradient-to-br",
              )}
            >
              {shownCover ? (
                <Image
                  src={shownCover}
                  alt={`Cover of ${className}`}
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                ref={coverInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="sr-only"
                onChange={(event) =>
                  pick("cover", event.target.files?.[0] ?? null)
                }
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => coverInputRef.current?.click()}
                disabled={busy}
              >
                <ImagePlus
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                />
                {coverUrl ? "Replace cover" : "Upload cover"}
              </Button>
              {coverUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void remove("cover")}
                  disabled={busy}
                >
                  <Trash2
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                  />
                  Remove cover
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mt-6 flex items-center gap-4">
            <span className="border-border bg-muted relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border">
              {shownAvatar ? (
                <Image
                  src={shownAvatar}
                  alt=""
                  width={64}
                  height={64}
                  unoptimized
                  className="h-16 w-16 object-cover"
                />
              ) : (
                <ImagePlus
                  aria-hidden="true"
                  className="text-muted-foreground h-5 w-5"
                />
              )}
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="sr-only"
                onChange={(event) =>
                  pick("avatar", event.target.files?.[0] ?? null)
                }
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => avatarInputRef.current?.click()}
                disabled={busy}
              >
                {avatarUrl ? "Replace image" : "Upload image"}
              </Button>
              {avatarUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void remove("avatar")}
                  disabled={busy}
                >
                  <Trash2
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                  />
                  Remove image
                </Button>
              ) : null}
            </div>
          </div>
        </>
      )}

      {pending ? (
        <div className="border-border bg-subtle mt-4 rounded-lg border p-3">
          <p className="text-sm font-medium">
            Save this {pending.kind === "cover" ? "cover" : "profile image"}?
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            The preview above is local. Nothing is stored until you save.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => void save()}
              disabled={busy}
            >
              {busy ? (
                <Loader2
                  aria-hidden="true"
                  className="h-3.5 w-3.5 animate-spin"
                />
              ) : null}
              {busy ? "Uploading..." : "Save image"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={cancel}
              disabled={busy}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
