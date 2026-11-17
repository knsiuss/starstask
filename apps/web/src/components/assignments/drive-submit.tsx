"use client";

import { FolderOpen, Loader2, PlugZap } from "lucide-react";
import { useEffect, useState } from "react";

import { DriveLecturerLinkCard } from "@/components/assignments/detail/drive-lecturer-link-card";
import {
  googleGlobals,
  loadScript,
  openDrivePicker,
  type PickerDoc,
} from "@/components/assignments/detail/drive-picker";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { getSiteUrl } from "@/lib/env/public";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const DRIVE_DOWNLOAD_BASE = "https://www.googleapis.com/drive/v3/files";
const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const PICKER_SCRIPT_SRC = "https://docs.google.com/picker";

export function DriveSubmit({
  assignmentId,
  clientId,
}: {
  assignmentId: string;
  clientId: string;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [lecturerUrl, setLecturerUrl] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [pickedName, setPickedName] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/integrations/google-drive/status")
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { data?: { connected?: boolean } } | null) => {
        if (cancelled) return;
        setConnected(Boolean(body?.data?.connected));
      })
      .catch(() => {
        if (!cancelled) {
          setConnected(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const configured = clientId.length > 0;
  const isConnected = connected === true;

  async function getPickerToken(): Promise<string> {
    if (isConnected) {
      const response = await fetch(
        "/api/integrations/google-drive/access-token",
      );
      const body = (await response.json()) as {
        data?: { accessToken?: string };
      };

      if (response.ok && body.data?.accessToken) {
        return body.data.accessToken;
      }

      throw new Error("Drive connection expired. Reconnect in Settings.");
    }

    if (!configured) {
      throw new Error(
        "Google Drive is not connected. Connect it in Settings first.",
      );
    }

    await loadScript(GIS_SCRIPT_SRC);
    const google = googleGlobals();

    if (!google) {
      throw new Error("Google scripts did not load.");
    }

    return new Promise<string | null>((resolve) => {
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_SCOPE,
        callback: (response: { access_token?: string }) => {
          resolve(response.access_token ?? null);
        },
      });
      tokenClient.requestAccessToken();
    }).then((token) => {
      if (!token) {
        throw new Error("Google sign-in was cancelled.");
      }

      return token;
    });
  }

  async function submitPickedFile(picked: PickerDoc, token: string) {
    let file: File | null = null;

    try {
      const response = await fetch(
        `${DRIVE_DOWNLOAD_BASE}/${encodeURIComponent(picked.id)}?alt=media`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!response.ok) {
        throw new Error("Could not download from Drive.");
      }

      const blob = await response.blob();
      file = new File([blob], picked.name, {
        type: picked.mimeType || blob.type,
      });
    } catch {
      file = null;
    }

    if (!file) {
      throw new Error("Could not download the file from Drive.");
    }

    const form = new FormData();
    form.append("file", file);
    form.append("drive_file_id", picked.id);

    const submitResponse = await fetch(
      `/api/assignments/${assignmentId}/drive-submit`,
      { method: "POST", body: form },
    );
    const body = (await submitResponse.json()) as {
      data?: { lecturerPath?: string; submissionId?: string };
      error?: { message?: string };
    };

    if (!submitResponse.ok || !body.data?.lecturerPath) {
      throw new Error(body.error?.message ?? "Server rejected the submission.");
    }

    const base = getSiteUrl().replace(/\/$/, "");
    setLecturerUrl(`${base}${body.data.lecturerPath}`);
    setSubmissionId(body.data.submissionId ?? null);
    toast({
      variant: "success",
      title: "Submitted via Drive.",
      description: "Copy the lecturer link below and forward it.",
    });
  }

  async function handleSubmit() {
    setBusy(true);

    try {
      await loadScript(PICKER_SCRIPT_SRC);
      const google = googleGlobals();

      if (!google) {
        throw new Error("Google scripts did not load.");
      }

      const token = await getPickerToken();
      const picked = await openDrivePicker(google, token);

      if (!picked) {
        return;
      }

      setPickedName(picked.name);
      await submitPickedFile(picked, token);
    } catch (error) {
      toast({
        variant: "error",
        title: "Drive submission failed.",
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function revokeLink() {
    if (!submissionId || revoking) {
      return;
    }

    setRevoking(true);

    try {
      const response = await fetch(
        `/api/assignments/${assignmentId}/drive-submissions/${submissionId}/revoke`,
        { method: "POST" },
      );

      if (!response.ok) {
        throw new Error("Could not revoke the link.");
      }

      setLecturerUrl(null);
      setSubmissionId(null);
      toast({ variant: "success", title: "Share link revoked." });
    } catch (error) {
      toast({
        variant: "error",
        title: error instanceof Error ? error.message : "Revoke failed.",
      });
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div className="space-y-3">
      {connected === false ? (
        <Button
          asChild
          variant="secondary"
          className="min-h-[44px] w-full"
        >
          <a href="/api/integrations/google-drive/start">
            <PlugZap
              aria-hidden="true"
              className="h-4 w-4"
            />
            Connect Google Drive once
          </a>
        </Button>
      ) : null}

      <Button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={busy || connected === null}
        className="min-h-[44px] w-full"
      >
        {busy ? (
          <Loader2
            aria-hidden="true"
            className="h-4 w-4 animate-spin"
          />
        ) : (
          <FolderOpen
            aria-hidden="true"
            className="h-4 w-4"
          />
        )}
        {busy
          ? "Picking from Drive..."
          : pickedName
            ? `Submit ${pickedName} from Drive`
            : "Submit from Google Drive"}
      </Button>

      {connected === null ? (
        <p className="text-muted-foreground text-xs">
          Checking Drive status...
        </p>
      ) : isConnected ? (
        <p className="text-muted-foreground text-xs leading-relaxed">
          Drive connected. Only the file you pick is shared. Your other Drive
          files stay private.
        </p>
      ) : (
        <p className="text-muted-foreground text-xs leading-relaxed">
          Connect once in Settings, or sign in with Google here for a one-time
          pick. Only the file you pick is shared.
        </p>
      )}

      {lecturerUrl ? (
        <DriveLecturerLinkCard
          lecturerUrl={lecturerUrl}
          submissionId={submissionId}
          revoking={revoking}
          onRevoke={() => void revokeLink()}
        />
      ) : null}
    </div>
  );
}
