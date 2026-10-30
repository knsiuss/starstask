"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  DEVELOPER_INCIDENT_NOTE_MAX,
  DEVELOPER_INCIDENT_SEVERITIES,
  DEVELOPER_INCIDENT_STATUS_LABELS,
  DEVELOPER_INCIDENT_STATUSES,
  DEVELOPER_INCIDENT_TITLE_MAX,
  type DeveloperIncidentSeverity,
  type DeveloperIncidentStatus,
} from "@starstask/contracts";
import { formatDate } from "@starstask/shared";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { DeveloperIncidentWithNotes } from "@/lib/db/developer-operations";

type ApiErrorBody = {
  error?: { message?: string; fieldErrors?: Record<string, string> };
};

async function callApi(
  url: string,
  method: string,
  body: unknown,
): Promise<string | null> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (response.ok) {
    return null;
  }

  let message = "The request failed. Please try again.";

  try {
    const payload = (await response.json()) as ApiErrorBody;

    if (payload.error?.message) {
      message = payload.error.message;
    }
  } catch {
    // Keep the generic message.
  }

  return message;
}

function severityBadgeVariant(severity: DeveloperIncidentSeverity) {
  if (severity === "high") {
    return "danger" as const;
  }

  return severity === "medium" ? ("warning" as const) : ("neutral" as const);
}

function statusBadgeVariant(status: DeveloperIncidentStatus) {
  if (status === "open") {
    return "danger" as const;
  }

  return status === "monitoring" ? ("warning" as const) : ("success" as const);
}

function CreateIncidentForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const data = new FormData(form);

    setPending(true);

    const failure = await callApi("/api/developer/incidents", "POST", {
      title: String(data.get("title") ?? ""),
      severity: String(data.get("severity") ?? "medium"),
      note: String(data.get("note") ?? "").trim() || undefined,
    });

    setPending(false);

    if (failure) {
      setError(failure);
      return;
    }

    form.reset();
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-border border-b px-4 py-4"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <Label htmlFor="incident-title">Title</Label>
          <Input
            id="incident-title"
            name="title"
            required
            minLength={3}
            maxLength={DEVELOPER_INCIDENT_TITLE_MAX}
            placeholder="What is going wrong?"
            className="mt-1.5"
          />
        </div>

        <div className="w-40">
          <Label htmlFor="incident-severity">Severity</Label>
          <Select
            id="incident-severity"
            name="severity"
            defaultValue="medium"
            className="mt-1.5"
          >
            {DEVELOPER_INCIDENT_SEVERITIES.map((severity) => (
              <option
                key={severity}
                value={severity}
              >
                {severity}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mt-3">
        <Label htmlFor="incident-note">Opening note (optional)</Label>
        <Textarea
          id="incident-note"
          name="note"
          rows={2}
          maxLength={DEVELOPER_INCIDENT_NOTE_MAX}
          placeholder="Context, affected service, first observations."
          className="mt-1.5"
        />
      </div>

      {error ? (
        <Alert
          variant="error"
          className="mt-3"
        >
          {error}
        </Alert>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        size="sm"
        disabled={pending}
        className="mt-3"
      >
        {pending ? "Creating…" : "Open incident"}
      </Button>
    </form>
  );
}

function StatusActions({ incident }: { incident: DeveloperIncidentWithNotes }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(status: DeveloperIncidentStatus) {
    setError(null);
    setPending(true);

    const failure = await callApi(
      `/api/developer/incidents/${incident.id}`,
      "PATCH",
      { status },
    );

    setPending(false);

    if (failure) {
      setError(failure);
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {DEVELOPER_INCIDENT_STATUSES.filter(
        (status) => status !== incident.status,
      ).map((status) => (
        <Button
          key={status}
          type="button"
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => void setStatus(status)}
        >
          {status === "resolved"
            ? "Mark resolved"
            : `Set ${DEVELOPER_INCIDENT_STATUS_LABELS[status].toLowerCase()}`}
        </Button>
      ))}

      {error ? (
        <p
          role="alert"
          className="text-danger text-xs"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function NoteForm({ incidentId }: { incidentId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const body = String(new FormData(form).get("body") ?? "").trim();

    if (body.length === 0) {
      setError("Write a note first.");
      return;
    }

    setPending(true);

    const failure = await callApi(
      `/api/developer/incidents/${incidentId}/notes`,
      "POST",
      { body },
    );

    setPending(false);

    if (failure) {
      setError(failure);
      return;
    }

    form.reset();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
      <Textarea
        name="body"
        rows={2}
        maxLength={DEVELOPER_INCIDENT_NOTE_MAX}
        placeholder="Add an investigation note."
        aria-label="New note"
      />

      {error ? (
        <p
          role="alert"
          className="text-danger mt-1 text-xs"
        >
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        variant="secondary"
        size="sm"
        disabled={pending}
        className="mt-2"
      >
        {pending ? "Adding…" : "Add note"}
      </Button>
    </form>
  );
}

export function DeveloperIncidentConsole({
  incidents,
}: {
  incidents: DeveloperIncidentWithNotes[];
}) {
  return (
    <div className="border-border bg-surface mt-5 rounded-xl border">
      <div className="border-border border-b px-4 py-3">
        <h3 className="text-sm font-semibold tracking-tight">
          Open a new incident
        </h3>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Every change is stored with your server-verified account ID. Incidents
          cannot be deleted from the console.
        </p>
      </div>

      <CreateIncidentForm />

      {incidents.length === 0 ? (
        <p className="text-muted-foreground px-4 py-8 text-sm leading-relaxed">
          No incidents recorded for this filter.
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {incidents.map((incident) => (
            <li
              key={incident.id}
              className="px-4 py-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{incident.title}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Opened {formatDate(incident.createdAt)} · updated{" "}
                    {formatDate(incident.updatedAt)}
                    {incident.resolvedAt
                      ? ` · resolved ${formatDate(incident.resolvedAt)}`
                      : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Badge variant={severityBadgeVariant(incident.severity)}>
                    {incident.severity}
                  </Badge>
                  <Badge variant={statusBadgeVariant(incident.status)}>
                    {DEVELOPER_INCIDENT_STATUS_LABELS[incident.status]}
                  </Badge>
                </div>
              </div>

              <div className="mt-3">
                <StatusActions incident={incident} />
              </div>

              {incident.notes.length > 0 ? (
                <ul className="border-border bg-background mt-3 divide-y rounded-lg border">
                  {incident.notes.map((note) => (
                    <li
                      key={note.id}
                      className="px-3 py-2"
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {note.body}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {formatDate(note.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-3">
                <NoteForm incidentId={incident.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
