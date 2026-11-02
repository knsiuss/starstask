"use client";

import { Loader2, Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  PROFILE_BIO_MAX,
  PROFILE_FULL_NAME_MAX,
  PROFILE_NICKNAME_MAX,
  profileSettingsSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ProfileAvatarDialog } from "@/components/profile/profile-avatar-dialog";
import {
  ProfileRow,
  ProfileSection,
} from "@/components/profile/profile-section";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUnsavedChanges } from "@/lib/hooks/use-unsaved-changes";

type ProfileEditorProps = {
  fullName: string;
  nickname: string;
  bio: string;
  email: string | null;
  avatarUrl: string | null;
  memberSince: string | null;
  activeClassCount: number;
  children: React.ReactNode;
};

type FieldValues = {
  fullName: string;
  nickname: string;
  bio: string;
};

type SaveResponse = {
  data?: {
    profile?: { fullName: string | null; nickname: string; bio: string | null };
  };
  error?: { message?: string; fields?: Record<string, string> };
};

/**
 * The profile page shell: title, identity card, and the personal-information
 * block, followed by whatever sections the page passes as children.
 *
 * One client component owns the only "Edit profile" affordance and the form it
 * opens. Nothing is a form until the owner asks to change it; the page reads as
 * plain text the rest of the time.
 */
export function ProfileEditor({
  fullName,
  nickname,
  bio,
  email,
  avatarUrl,
  memberSince,
  activeClassCount,
  children,
}: ProfileEditorProps) {
  const router = useRouter();

  const [isEditing, setIsEditing] = React.useState(false);
  const [values, setValues] = React.useState<FieldValues>({
    fullName,
    nickname,
    bio,
  });
  const [savedValues, setSavedValues] = React.useState<FieldValues>({
    fullName,
    nickname,
    bio,
  });
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [formError, setFormError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [justSaved, setJustSaved] = React.useState(false);

  const isDirty =
    values.fullName !== savedValues.fullName ||
    values.nickname !== savedValues.nickname ||
    values.bio !== savedValues.bio;

  useUnsavedChanges(isEditing && isDirty);

  const startEdit = () => {
    setJustSaved(false);
    setIsEditing(true);

    window.requestAnimationFrame(() => {
      document
        .getElementById("personal-information")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const cancelEdit = () => {
    setValues(savedValues);
    setFieldErrors({});
    setFormError(null);
    setIsEditing(false);
  };

  const update = (field: keyof FieldValues, value: string) => {
    setValues((previous) => ({ ...previous, [field]: value }));
    setFieldErrors((previous) => {
      if (!previous[field]) {
        return previous;
      }

      const next = { ...previous };
      delete next[field];
      return next;
    });
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    setFormError(null);
    setJustSaved(false);

    const parsed = profileSettingsSchema.safeParse(values);

    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await response
        .json()
        .catch(() => null)) as SaveResponse | null;

      if (!response.ok) {
        setFieldErrors(body?.error?.fields ?? {});
        setFormError(body?.error?.message ?? "Could not save your profile.");
        return;
      }

      const next: FieldValues = {
        fullName: body?.data?.profile?.fullName ?? parsed.data.fullName,
        nickname: body?.data?.profile?.nickname ?? parsed.data.nickname,
        bio: body?.data?.profile?.bio ?? "",
      };

      setValues(next);
      setSavedValues(next);
      setIsEditing(false);
      setJustSaved(true);
      router.refresh();
    } catch {
      setFormError("Network error. Check your connection and try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const displayName = savedValues.fullName || savedValues.nickname;

  return (
    <div>
      <header>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight sm:text-3xl">
          Profile
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Your profile and class representative access.
        </p>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:items-start">
        <aside className="border-border bg-surface rounded-xl border p-5">
          <div className="flex justify-center">
            <ProfileAvatarDialog
              avatarUrl={avatarUrl}
              displayName={displayName}
            />
          </div>

          <p className="text-foreground mt-4 text-center text-base font-semibold break-words">
            {displayName}
          </p>
          <p className="text-muted-foreground mt-0.5 text-center text-sm">
            @{savedValues.nickname}
          </p>
          {email ? (
            <p className="text-muted-foreground mt-0.5 truncate text-center text-xs">
              {email}
            </p>
          ) : null}

          <div className="mt-2.5 flex justify-center">
            <Badge variant="accent">Student</Badge>
          </div>

          {!isEditing ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={startEdit}
              className="mt-4 w-full"
            >
              <Pencil
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
              Edit profile
            </Button>
          ) : null}

          <p className="text-muted-foreground mt-4 text-center text-xs">
            {activeClassCount === 0
              ? "No classes yet"
              : `${activeClassCount} active ${activeClassCount === 1 ? "class" : "classes"}`}
            {memberSince ? ` · Joined ${memberSince}` : null}
          </p>
        </aside>

        <div className="min-w-0">
          <ProfileSection
            id="personal-information"
            title="Personal information"
            className="scroll-mt-24"
            action={
              isEditing ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={cancelEdit}
                    disabled={isSaving}
                  >
                    <X
                      aria-hidden="true"
                      className="h-3.5 w-3.5"
                    />
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    form="profile-settings-form"
                    disabled={isSaving || !isDirty}
                    aria-busy={isSaving}
                  >
                    {isSaving ? (
                      <Loader2
                        aria-hidden="true"
                        className="h-3.5 w-3.5 animate-spin"
                      />
                    ) : null}
                    {isSaving ? "Saving..." : "Save changes"}
                  </Button>
                </div>
              ) : null
            }
          >
            {justSaved && !isEditing ? (
              <div className="px-5 pb-4">
                <Alert variant="success">Profile updated.</Alert>
              </div>
            ) : null}

            {formError ? (
              <div className="px-5 pb-4">
                <Alert variant="error">{formError}</Alert>
              </div>
            ) : null}

            {isEditing ? (
              <form
                id="profile-settings-form"
                onSubmit={(event) => void submit(event)}
                noValidate
                className="border-border space-y-4 border-t px-5 py-4"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="fullName">Full name</Label>
                    <Input
                      id="fullName"
                      name="fullName"
                      value={values.fullName}
                      onChange={(event) =>
                        update("fullName", event.target.value)
                      }
                      maxLength={PROFILE_FULL_NAME_MAX}
                      autoComplete="name"
                      aria-invalid={Boolean(fieldErrors.fullName)}
                      aria-describedby="fullName-hint"
                      className="mt-1.5"
                    />
                    {fieldErrors.fullName ? (
                      <p className="text-danger mt-1 text-xs">
                        {fieldErrors.fullName}
                      </p>
                    ) : (
                      <p
                        id="fullName-hint"
                        className="text-muted-foreground mt-1 text-xs"
                      >
                        Only you can see this.
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="nickname">Nickname</Label>
                    <Input
                      id="nickname"
                      name="nickname"
                      value={values.nickname}
                      onChange={(event) =>
                        update("nickname", event.target.value)
                      }
                      maxLength={PROFILE_NICKNAME_MAX}
                      autoComplete="nickname"
                      aria-invalid={Boolean(fieldErrors.nickname)}
                      aria-describedby="nickname-hint"
                      className="mt-1.5"
                    />
                    {fieldErrors.nickname ? (
                      <p className="text-danger mt-1 text-xs">
                        {fieldErrors.nickname}
                      </p>
                    ) : (
                      <p
                        id="nickname-hint"
                        className="text-muted-foreground mt-1 text-xs"
                      >
                        Shown to classmates.
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="bio">Bio</Label>
                    <span
                      id="bio-count"
                      className="text-muted-foreground text-xs tabular-nums"
                    >
                      {values.bio.length}/{PROFILE_BIO_MAX}
                    </span>
                  </div>
                  <Textarea
                    id="bio"
                    name="bio"
                    value={values.bio}
                    onChange={(event) => update("bio", event.target.value)}
                    maxLength={PROFILE_BIO_MAX}
                    rows={3}
                    className="mt-1.5 min-h-24"
                    aria-invalid={Boolean(fieldErrors.bio)}
                    aria-describedby="bio-help bio-count"
                    placeholder="A short introduction for your classmates."
                  />
                  {fieldErrors.bio ? (
                    <p className="text-danger mt-1 text-xs">
                      {fieldErrors.bio}
                    </p>
                  ) : (
                    <p
                      id="bio-help"
                      className="text-muted-foreground mt-1 text-xs"
                    >
                      Up to {PROFILE_BIO_MAX} characters.
                    </p>
                  )}
                </div>
              </form>
            ) : (
              <dl className="border-border divide-border divide-y border-t">
                <ProfileRow
                  label="Full name"
                  note="Only you can see this."
                  muted={!savedValues.fullName}
                >
                  {savedValues.fullName || "Not set"}
                </ProfileRow>
                <ProfileRow label="Nickname">
                  @{savedValues.nickname}
                </ProfileRow>
                <ProfileRow
                  label="Bio"
                  muted={!savedValues.bio}
                >
                  {savedValues.bio ? (
                    <p className="whitespace-pre-line">{savedValues.bio}</p>
                  ) : (
                    "No bio yet"
                  )}
                </ProfileRow>
                <ProfileRow
                  label="Email"
                  note="From your sign-in provider."
                  muted={!email}
                >
                  {email ?? "Not available"}
                </ProfileRow>
              </dl>
            )}
          </ProfileSection>

          <div className="mt-6 space-y-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
