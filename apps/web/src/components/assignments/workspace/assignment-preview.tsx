import {
  CalendarClock,
  CheckCircle2,
  Clock,
  GraduationCap,
  Link2,
  Paperclip,
} from "lucide-react";

type PreviewProps = {
  title: string;
  courseName: string;
  className: string;
  deadline: string;
  attachmentCount: number;
};

const deadlineFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Live preview card: reflects the form state as the user types. */
export function AssignmentPreview({
  title,
  courseName,
  className,
  deadline,
  attachmentCount,
}: PreviewProps) {
  return (
    <section
      aria-label="Assignment preview"
      className="border-border bg-surface rounded-xl border p-4"
    >
      <h3 className="text-foreground text-xs font-semibold tracking-wide uppercase">
        Assignment Preview
      </h3>
      <div className="bg-band mt-3 rounded-lg p-3">
        <p className="text-foreground line-clamp-2 text-sm font-semibold tracking-tight">
          {title.trim() || "Untitled assignment"}
        </p>
        <dl className="mt-3 space-y-2 text-xs">
          <PreviewRow
            icon={
              <GraduationCap
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
            }
            label="Course"
            value={courseName}
          />
          <PreviewRow
            icon={
              <Link2
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
            }
            label="Class"
            value={className}
          />
          <PreviewRow
            icon={
              <CalendarClock
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
            }
            label="Deadline"
            value={
              deadline
                ? deadlineFormatter.format(new Date(deadline))
                : "No deadline set"
            }
          />
          <PreviewRow
            icon={
              <Paperclip
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
            }
            label="Attachments"
            value={
              attachmentCount > 0
                ? `${attachmentCount} file${attachmentCount === 1 ? "" : "s"}`
                : "None"
            }
          />
        </dl>
      </div>
    </section>
  );
}

function PreviewRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground inline-flex items-center gap-1.5">
        {icon}
        {label}
      </dt>
      <dd className="text-foreground truncate font-medium">{value}</dd>
    </div>
  );
}

const TIPS = [
  "Write a clear and specific title.",
  "Provide detailed instructions.",
  "Set a realistic deadline.",
  "Attach reference materials if necessary.",
];

/** Writing guidance card. */
export function AssignmentTips() {
  return (
    <section
      aria-label="Tips for a great assignment"
      className="border-border bg-surface rounded-xl border p-4"
    >
      <h3 className="text-foreground text-xs font-semibold tracking-wide uppercase">
        Tips for a Great Assignment
      </h3>
      <ul className="mt-3 space-y-2">
        {TIPS.map((tip) => (
          <li
            key={tip}
            className="text-muted-foreground flex items-start gap-2 text-xs leading-relaxed"
          >
            <CheckCircle2
              aria-hidden="true"
              className="text-accent mt-0.5 h-3.5 w-3.5 shrink-0"
            />
            {tip}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Contextual publication permission card for the selected class. */
export function PublicationPermissionCard({
  managesClass,
}: {
  managesClass: boolean;
}) {
  return (
    <section
      aria-label="Publication permission"
      className="border-border bg-surface rounded-xl border p-4"
    >
      <h3 className="text-foreground text-xs font-semibold tracking-wide uppercase">
        Publication Permission
      </h3>
      <div
        className={`mt-3 flex items-start gap-2.5 rounded-lg p-3 ${
          managesClass ? "bg-success-soft" : "bg-warning-soft"
        }`}
      >
        {managesClass ? (
          <CheckCircle2
            aria-hidden="true"
            className="text-success mt-0.5 h-4 w-4 shrink-0"
          />
        ) : (
          <Clock
            aria-hidden="true"
            className="text-warning mt-0.5 h-4 w-4 shrink-0"
          />
        )}
        <p className="text-foreground text-xs leading-relaxed">
          {managesClass
            ? "This assignment will be published directly to students after creation."
            : "Your assignment will be submitted for administrator review."}
        </p>
      </div>
    </section>
  );
}
