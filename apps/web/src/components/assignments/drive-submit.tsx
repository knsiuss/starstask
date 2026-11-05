"use client";

import { Check, FolderOpen, Link2, Loader2 } from "lucide-react";
import { useRef, useState } from "react";

import { CopyLinkButton } from "@/components/assignments/copy-link-button";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { getSiteUrl } from "@/lib/env/public";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const DRIVE_DOWNLOAD_BASE = "https://www.googleapis.com/drive/v3/files";
const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const PICKER_SCRIPT_SRC = "https://docs.google.com/picker";

/** Mutable refs must be read, never invoked as hooks. */
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
  const tokenRef = useRef<string | null>(null);

  const configured = clientId.length > 0;

  async function handleSubmit() {
    if (!configured) {
      toast({
        variant: "error",
        title: "Google Drive is not configured yet.",
        description:
          "Set NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID to enable Drive submission.",
      });
      return;
    }

    setBusy(true);
    try {
      await loadScript(GIS_SCRIPT_SRC);
      await loadScript(PICKER_SCRIPT_SRC);
      const google = googleGlobals();
      if (!google) throw new Error("Google scripts did not load.");

      const token = await new Promise<string | null>((resolve) => {
        const tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: DRIVE_SCOPE,
          callback: (response: { access_token?: string; error?: string }) => {
            resolve(response.access_token ?? null);
          },
        });
        tokenClient.requestAccessToken();
      });

      if (!token) {
        throw new Error("Google sign-in was cancelled.");
      }
      tokenRef.current = token;

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
    const response = await fetch(
      `${DRIVE_DOWNLOAD_BASE}/${encodeURIComponent(picked.id)}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok) {
      throw new Error("Could not download the file from Drive.");
    }

    const blob = await response.blob();
    const file = new File([blob], picked.name, {
      type: picked.mimeType || blob.type,
    });

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
      <Button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={busy}
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

      {!configured ? (
        <p className="text-muted-foreground text-xs">
          Drive picker is not configured on this deployment yet. Add
          NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID (Google Cloud OAuth client) to
          enable it.
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">
          Only the file you pick is shared. Your other Drive files stay private.
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
    void token;
  });
}
