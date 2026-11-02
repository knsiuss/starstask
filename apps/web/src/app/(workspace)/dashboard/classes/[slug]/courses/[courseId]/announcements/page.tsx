import { Megaphone, Paperclip, PlusCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CourseWorkspaceHeader } from "@/components/classes/course-workspace-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { requireCourseContext } from "@/features/classes/course-access";
import { listCourseAssignments } from "@/lib/db/classes";
import { formatDate, pluralize } from "@starstask/shared";

export const metadata: Metadata = {
  title: "Course announcements",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type CourseAnnouncementsPageProps = {
  params: Promise<{ slug: string; courseId: string }>;
  searchParams: Promise<{ posted?: string }>;
};

export default async function CourseAnnouncementsPage({
  params,
  searchParams,
}: CourseAnnouncementsPageProps) {
  const { slug, courseId } = await params;
  const { posted } = await searchParams;
  const {
    class: found,
    role,
    course,
  } = await requireCourseContext(slug, courseId);

  const announcements = await listCourseAssignments(found.id, course.id, {
    contentType: "class_announcement",
    limit: 50,
  });
  const canPost =
    role.canManage && found.status === "active" && course.status === "active";

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <CourseWorkspaceHeader
        classSlug={found.slug}
        className={found.name}
        semester={found.semester}
        academicYear={found.academic_year}
        course={course}
        activeTab="announcements"
        canManage={role.canManage}
        classActive={found.status === "active"}
      />

      {posted ? (
        <Alert
          variant="success"
          className="mt-6"
        >
          Your announcement is published in {course.name}.
        </Alert>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Announcements
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {announcements.length}{" "}
            {pluralize(announcements.length, "announcement")} posted in this
            course.
          </p>
        </div>

        {canPost ? (
          <Button
            asChild
            size="sm"
          >
            <Link
              href={`/dashboard/classes/${found.slug}/submit?course=${course.id}&type=class_announcement`}
            >
              <PlusCircle
                aria-hidden="true"
                className="h-4 w-4"
              />
              Post announcement
            </Link>
          </Button>
        ) : null}
      </div>

      {announcements.length === 0 ? (
        <div className="border-border bg-subtle mt-6 rounded-xl border border-dashed px-5 py-12 text-center">
          <Megaphone
            aria-hidden="true"
            className="text-muted-foreground mx-auto h-6 w-6"
          />
          <p className="mt-2 text-sm font-medium">
            No announcements in this course yet
          </p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs">
            Class-wide notices belong to a course too. Post one here instead of
            mixing it into the class group.
          </p>
        </div>
      ) : (
        <ul className="divide-border border-border mt-4 divide-y border-y">
          {announcements.map((announcement) => (
            <li
              key={announcement.id}
              className="py-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/assignments/${announcement.id}`}
                      className="text-accent text-sm font-medium underline-offset-4 hover:underline"
                    >
                      {announcement.title}
                    </Link>
                    {announcement.attachment_count > 0 ? (
                      <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                        <Paperclip
                          aria-hidden="true"
                          className="h-3 w-3"
                        />
                        {announcement.attachment_count}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground mt-1 max-w-3xl text-sm leading-relaxed">
                    {announcement.description}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Posted{" "}
                    {formatDate(
                      announcement.published_at ?? announcement.created_at,
                    )}
                  </p>
                </div>

                {role.canManage ? (
                  <div className="flex shrink-0 flex-wrap items-center gap-1">
                    <Button
                      asChild
                      size="sm"
                      variant="ghost"
                    >
                      <Link href={`/assignments/${announcement.id}/edit`}>
                        Edit
                      </Link>
                    </Button>
                    <Button
                      asChild
                      size="sm"
                      variant="ghost"
                    >
                      <Link
                        href={`/dashboard/classes/${found.slug}/review/${announcement.id}`}
                      >
                        Review
                      </Link>
                    </Button>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
