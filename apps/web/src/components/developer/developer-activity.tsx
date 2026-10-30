import { Activity, LogIn, UserPlus } from "lucide-react";

import { formatDate } from "@starstask/shared";

import type {
  DeveloperActivityItem,
  DeveloperAuthEvent,
  DeveloperRegistration,
} from "@/lib/db/developer";

function shortId(id: string | null): string {
  return id ? id.slice(0, 8) : "unknown";
}

function humanize(value: string): string {
  const text = value.replaceAll("_", " ");

  return text.charAt(0).toUpperCase() + text.slice(1);
}

function PanelHeader({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: typeof LogIn;
}) {
  return (
    <div className="border-border border-b px-4 py-3">
      <h2 className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
        <Icon
          aria-hidden="true"
          className="h-4 w-4"
        />
        {title}
      </h2>
      <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
    </div>
  );
}

export function DeveloperAuthActivity({
  events,
  registrations,
}: {
  events: DeveloperAuthEvent[];
  registrations: DeveloperRegistration[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section
        aria-labelledby="sign-in-activity"
        className="border-border bg-surface rounded-xl border"
      >
        <PanelHeader
          title="Sign-in activity"
          description="Server-recorded callback outcomes, newest first."
          icon={LogIn}
        />
        {events.length === 0 ? (
          <p className="text-muted-foreground px-4 py-6 text-xs leading-relaxed">
            No sign-in events recorded yet. Recording starts when this feature
            is deployed; earlier history is not available.
          </p>
        ) : (
          <ul className="divide-border divide-y">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex items-start justify-between gap-3 px-4 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm">
                    {event.eventType === "sign_in_succeeded"
                      ? "Sign-in succeeded"
                      : "Sign-in failed"}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {event.eventType === "sign_in_succeeded"
                      ? `User ${shortId(event.userId)}`
                      : event.reason
                        ? humanize(event.reason)
                        : "Unknown reason"}
                    {event.provider ? ` · ${event.provider}` : ""}
                  </p>
                </div>
                <time
                  dateTime={event.createdAt}
                  className="text-muted-foreground shrink-0 text-xs"
                >
                  {formatDate(event.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="registration-activity"
        className="border-border bg-surface rounded-xl border"
      >
        <PanelHeader
          title="Recent registrations"
          description="Newest profile rows produced when an Auth account is created."
          icon={UserPlus}
        />
        {registrations.length === 0 ? (
          <p className="text-muted-foreground px-4 py-6 text-xs leading-relaxed">
            No registrations yet.
          </p>
        ) : (
          <ul className="divide-border divide-y">
            {registrations.map((registration) => (
              <li
                key={registration.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5"
              >
                <p className="font-mono text-xs">{shortId(registration.id)}</p>
                <time
                  dateTime={registration.createdAt}
                  className="text-muted-foreground text-xs"
                >
                  {formatDate(registration.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function DeveloperApplicationActivity({
  items,
}: {
  items: DeveloperActivityItem[];
}) {
  return (
    <section
      aria-labelledby="application-activity"
      className="border-border bg-surface mt-6 rounded-xl border"
    >
      <PanelHeader
        title="Recent application activity"
        description="Audit rows plus assignment create, update, and delete events."
        icon={Activity}
      />
      {items.length === 0 ? (
        <p className="text-muted-foreground px-4 py-6 text-xs leading-relaxed">
          No application activity recorded yet.
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm">{humanize(item.eventType)}</p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {humanize(item.resourceType)}
                  {item.resourceId ? ` · ${shortId(item.resourceId)}` : ""} ·
                  actor {shortId(item.actorId)} ·{" "}
                  {item.source === "audit" ? "audit log" : "activity log"}
                </p>
              </div>
              <time
                dateTime={item.createdAt}
                className="text-muted-foreground text-xs"
              >
                {formatDate(item.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
