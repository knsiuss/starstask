import { GraduationCap, Info, Share2, Users } from "lucide-react";
import Image from "next/image";

import { AssignmentHistory } from "@/components/assignments/assignment-history";
import { CopyLinkButton } from "@/components/assignments/copy-link-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { AssignmentRevision } from "@/lib/db/assignment-trust";
import { formatDate } from "@starstask/shared";

type AssignmentSidebarData = {
  course_name: string;
  course_code: string | null;
  course_department: string | null;
  semester: string | null;
  lecturer_name: string | null;
  academic_year: string | null;
  assignment_type: string | null;
  status: string;
  author_display_name: string;
  author_avatar_url: string | null;
  created_at: string;
};

type AssignmentDetailSidebarProps = {
  assignment: AssignmentSidebarData;
  revisions: AssignmentRevision[];
  canonicalUrl: string;
  whatsappUrl: string;
};

export function AssignmentDetailSidebar({
  assignment,
  revisions,
  canonicalUrl,
  whatsappUrl,
}: AssignmentDetailSidebarProps) {
  const isPublished = assignment.status === "published";
  const isRejected = assignment.status === "rejected";
  const statusLabel = isPublished
    ? "Published"
    : isRejected
      ? "Rejected"
      : assignment.status === "pending"
        ? "Pending approval"
        : "Not published";

  return (
    <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
      <Card className="rounded-xl p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Info
            aria-hidden="true"
            className="text-muted-foreground h-4 w-4"
          />
          Assignment information
        </h2>
        <dl className="divide-border/60 mt-3 divide-y text-sm">
          <InfoRow
            label="Course"
            value={assignment.course_name}
          />
          {assignment.course_code ? (
            <InfoRow
              label="Course code"
              value={assignment.course_code}
            />
          ) : null}
          {assignment.course_department ? (
            <InfoRow
              label="Department"
              value={assignment.course_department}
            />
          ) : null}
          {assignment.semester ? (
            <InfoRow
              label="Semester"
              value={assignment.semester}
            />
          ) : null}
          {assignment.lecturer_name ? (
            <InfoRow
              label="Lecturer"
              value={assignment.lecturer_name}
            />
          ) : null}
          {assignment.academic_year ? (
            <InfoRow
              label="Academic year"
              value={assignment.academic_year}
            />
          ) : null}
          {assignment.assignment_type ? (
            <InfoRow
              label="Type"
              value={assignment.assignment_type}
            />
          ) : null}
          <div className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
            <dt className="text-muted-foreground">Status</dt>
            <dd>
              <Badge
                variant={
                  isPublished ? "success" : isRejected ? "danger" : "warning"
                }
              >
                {statusLabel}
              </Badge>
            </dd>
          </div>
        </dl>
      </Card>

      <Card className="rounded-xl p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Users
            aria-hidden="true"
            className="text-muted-foreground h-4 w-4"
          />
          Contributor
        </h2>
        <div className="mt-3 flex items-center gap-3">
          {assignment.author_avatar_url ? (
            <Image
              src={assignment.author_avatar_url}
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span
              aria-hidden="true"
              className="bg-accent-soft text-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
            >
              {assignment.author_display_name.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="text-foreground truncate text-sm font-medium">
              {assignment.author_display_name}
            </p>
            <p className="text-muted-foreground text-xs">
              Contributed {formatDate(assignment.created_at)}
            </p>
          </div>
        </div>
      </Card>

      {isPublished ? (
        <Card className="rounded-xl p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Share2
              aria-hidden="true"
              className="text-muted-foreground h-4 w-4"
            />
            Share assignment
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Share this assignment with your class.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <CopyLinkButton url={canonicalUrl} />
            <Button
              asChild
              variant="secondary"
              size="sm"
              className="min-h-[44px] px-4 sm:min-h-8 sm:px-3"
            >
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <WhatsAppIcon className="h-3.5 w-3.5 text-[#25D366]" />
                Share on WhatsApp
              </a>
            </Button>
          </div>
        </Card>
      ) : null}

      <AssignmentHistory revisions={revisions} />

      <p className="text-muted-foreground flex items-start gap-2 px-1 text-xs leading-relaxed">
        <GraduationCap
          aria-hidden="true"
          className="mt-0.5 h-4 w-4 shrink-0"
        />
        Assignments are contributed by students and may be incomplete or
        outdated. Always confirm requirements with your lecturer.
      </p>
    </aside>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="text-foreground text-right font-medium break-words">
        {value}
      </dd>
    </div>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413" />
    </svg>
  );
}
