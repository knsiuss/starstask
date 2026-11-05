"use client";

import { Check, FolderOpen, Link2, Loader2, PlugZap } from "lucide-react";
import { useEffect, useState } from "react";

import { CopyLinkButton } from "@/components/assignments/copy-link-button";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { getSiteUrl } from "@/lib/env/public";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const DRIVE_DOWNLOAD_BASE = "https://www.googleapis.com/drive/v3/files";
const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const PICKER_SCRIPT_SRC = "https://docs.google.com/picker";

type PickerDoc = {
  id: string;
  name: string;
  mimeType: string;
};

type PickerBuilder = {
  addView: (view: unknown) => PickerBuilder;
  setOAuthToken: (token: string) => PickerBuilder;
  setCallback: (callback: (data: unknown) => void) => PickerBuilder;
  build: () => { setVisible: (visible: boolean) => void };
};

type GoogleGlobals = {
  accounts: {
    oauth2: {
      initTokenClient: (config: unknown) => {
        requestAccessToken: () => void;
      };
    };
  };
  picker: {
    PickerBuilder: new () => PickerBuilder;
    DocsView: new (viewId: string) => unknown;
    DocsUploadView: new () => unknown;
    Action: { PICKED: string };
  };
};

function googleGlobals(): GoogleGlobals | null {
  const candidate = (window as unknown as { google?: GoogleGlobals }).google;
  return candidate ?? null;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`,
    );
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Google scripts."));
    document.head.appendChild(script);
  });
}

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
  const [pickedName, setPickedName] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/integrations/google-drive/status")
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { data?: { connected?: boolean } } | null) => {
        if (body?.data) setConnected(Boolean(body.data.connected));
      })
      .catch(() => setConnected(false));
  }, []);

  const configured = clientId.length > 0;
  const isConnected = connected === true;

  async function getPickerToken(): Promise<string> {
    // Persistent connection: short-lived token from the server.
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

    // One-time fallback: client-side consent (not stored).
    if (!configured) {
      throw new Error(
        "Google Drive is not connected. Connect it in Settings first.",
      );
    }
    await loadScript(GIS_SCRIPT_SRC);
    const google = googleGlobals();
    if (!google) throw new Error("Google scripts did not load.");
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
      if (!token) throw new Error("Google sign-in was cancelled.");
      return token;
    });
  }

  async function handleSubmit() {
    setBusy(true);
    try {
      await loadScript(PICKER_SCRIPT_SRC);
      const google = googleGlobals();
      if (!google) throw new Error("Google scripts did not load.");

      const token = await getPickerToken();
      const picked = await openPicker(google, token);
      if (!picked) return;

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

  async function submitPickedFile(picked: PickerDoc, token: string) {
    // Preferred: server downloads via stored token (no browser token needed).
    // Fallback: browser downloads and uploads bytes.
    let file: File | null = null;

    try {
      const response = await fetch(
        `${DRIVE_DOWNLOAD_BASE}/${encodeURIComponent(picked.id)}?alt=media`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) throw new Error("Could not download from Drive.");
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
      data?: { lecturerPath?: string };
      error?: { message?: string };
    };
    if (!submitResponse.ok || !body.data?.lecturerPath) {
      throw new Error(body.error?.message ?? "Server rejected the submission.");
    }

    const base = getSiteUrl().replace(/\/$/, "");
    setLecturerUrl(`${base}${body.data.lecturerPath}`);
    toast({
      variant: "success",
      title: "Submitted via Drive.",
      description: "Copy the lecturer link below and forward it.",
    });
  }

  return (
    <div className="space-y-3">
      {connected === false ? (
        <Button
          asChild
          variant="secondary"
          className="w-full"
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
        className="w-full"
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
        <p className="text-muted-foreground text-xs">
          Drive connected. Only the file you pick is shared. Your other Drive
          files stay private.
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">
          Connect once in Settings, or sign in with Google here for a one-time
          pick. Only the file you pick is shared.
        </p>
      )}

      {lecturerUrl ? (
        <div className="border-border bg-muted/50 rounded-md border p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Check
              aria-hidden="true"
              className="h-4 w-4 text-green-600"
            />
            Ready for your lecturer
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Forward this link. Your lecturer does not need a StarsTask account.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <CopyLinkButton url={lecturerUrl} />
            <a
              href={lecturerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium underline underline-offset-4"
            >
              <Link2
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
              Open lecturer view
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function openPicker(
  google: GoogleGlobals,
  token: string,
): Promise<PickerDoc | null> {
  return new Promise((resolve) => {
    const builder = new google.picker.PickerBuilder();
    const view = new google.picker.DocsView("all");
    builder
      .addView(view)
      .setOAuthToken(token)
      .setCallback((data: unknown) => {
        const action = (data as { action?: string } | null)?.action;
        if (action === google.picker.Action.PICKED) {
          const docs = (data as { docs?: PickerDoc[] } | null)?.docs;
          resolve(docs?.[0] ?? null);
        } else {
          resolve(null);
        }
      });
    builder.build().setVisible(true);
  });
}
