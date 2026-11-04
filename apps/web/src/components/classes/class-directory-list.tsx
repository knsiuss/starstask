import {
  BookOpen,
  ChevronRight,
  ClipboardList,
  Crown,
  GraduationCap,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { ClassDirectoryMenu } from "@/components/classes/class-directory-menu";
import { StatusBadge } from "@/components/classes/status-badge";
import type { ClassDirectoryItem } from "@/lib/db/classes";
import { excerpt, formatCount, pluralize } from "@starstask/shared";
import type { ClassDirectoryView } from "@starstask/contracts";

type ClassDirectoryCardProps = {
  classItem: ClassDirectoryItem;
};

/**
 * The whole card is the link, so the title carries a stretched hit area and the
 * menu sits above it. `z-10` on the menu is what keeps its button clickable.
 */
const TITLE_LINK_CLASS =
  "rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent after:absolute after:inset-0";

function MetaDot() {
  return <span aria-hidden="true">·</span>;
}

function CardStat({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon;
  value: number;
  label: string;
}) {
  return (
    // On very narrow screens the icon stacks above the number so the three
    // stats plus the navigation arrow fit without squeezing the labels.
    <div className="flex min-w-0 flex-col gap-1 min-[420px]:flex-row min-[420px]:items-center min-[420px]:gap-2">
      <Icon
        aria-hidden="true"
        className="text-muted-foreground h-4 w-4 shrink-0"
      />
      <div className="leading-tight">
        <dd className="text-foreground text-sm font-medium tabular-nums">
          {formatCount(value)}
        </dd>
        <dt className="text-muted-foreground truncate text-[11px]">{label}</dt>
      </div>
    </div>
  );
}

export function ClassDirectoryCard({ classItem }: ClassDirectoryCardProps) {
  return (
    <article className="border-border bg-surface hover:border-accent/40 group relative flex h-full flex-col rounded-2xl border shadow-sm transition-colors">
      {/* No `overflow-hidden` on the card: it clipped the icon tile that is
          meant to straddle the cover edge. The cover rounds its own top
          corners instead, so nothing inside the card can be cut off. */}
      <div className="bg-accent-soft relative h-16 rounded-t-2xl sm:h-20">
        <div className="absolute top-2.5 right-2.5 z-10">
          <ClassDirectoryMenu
            classSlug={classItem.slug}
            className={classItem.name}
            isAdmin={classItem.is_admin}
          />
        </div>
      </div>

      <div className="px-4 pb-4 sm:px-5">
        {/* `relative z-10` matters: the cover above is positioned, so without it
            the cover paints over the top half of the icon tile. */}
        <div className="relative z-10 -mt-5 flex items-end justify-between gap-2">
          <span className="border-border bg-surface text-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border shadow-sm">
            <GraduationCap
              aria-hidden="true"
              className="h-5 w-5"
            />
          </span>
          <div className="flex items-center gap-2 pb-1">
            {classItem.status !== "active" ? (
              <StatusBadge status={classItem.status} />
            ) : null}
            {classItem.is_admin ? (
              <span className="bg-accent-soft text-accent inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium">
                <Crown
                  aria-hidden="true"
                  className="h-3 w-3"
                />
                Class Admin
              </span>
            ) : null}
          </div>
        </div>

        <h2 className="mt-3 text-lg leading-snug font-semibold tracking-tight break-words">
          <Link
            href={`/dashboard/classes/${classItem.slug}`}
            className={TITLE_LINK_CLASS}
          >
            {classItem.name}
          </Link>
        </h2>

        <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="bg-muted rounded px-1.5 py-0.5 font-mono text-[10px] tracking-wide">
            {classItem.class_code ?? classItem.slug}
          </span>
          <MetaDot />
          <span>Semester {classItem.semester}</span>
          <MetaDot />
          <span>{classItem.academic_year}</span>
        </p>

        {classItem.description ? (
          <p className="text-muted-foreground mt-2 line-clamp-2 text-sm leading-relaxed">
            {excerpt(classItem.description, 140)}
          </p>
        ) : null}
      </div>

      <div className="border-border mt-auto flex items-center justify-between gap-3 border-t px-4 py-3 sm:px-5">
        <dl className="grid flex-1 grid-cols-3 gap-2 min-[420px]:flex min-[420px]:items-center min-[420px]:gap-4">
          <CardStat
            icon={BookOpen}
            value={classItem.subject_count}
            label={pluralize(classItem.subject_count, "Subject")}
          />
          <CardStat
            icon={ClipboardList}
            value={classItem.published_count}
            label={pluralize(classItem.published_count, "Assignment")}
          />
          <CardStat
            icon={Users}
            value={classItem.member_count}
            label={pluralize(classItem.member_count, "Member")}
          />
        </dl>

        <span
          aria-hidden="true"
          className="border-border text-accent group-hover:border-accent/40 group-hover:bg-accent-soft flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </span>
      </div>
    </article>
  );
}

/** Dense alternative for scanning many groups at once. */
export function ClassDirectoryRow({ classItem }: ClassDirectoryCardProps) {
  return (
    <li className="relative">
      <div className="hover:bg-hover group flex items-center gap-3 px-1 py-3.5 transition-colors sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-[15px] leading-snug font-medium">
              <Link
                href={`/dashboard/classes/${classItem.slug}`}
                className={TITLE_LINK_CLASS}
              >
                {classItem.name}
              </Link>
            </h2>
            <span className="bg-muted text-muted-foreground shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] tracking-wide">
              {classItem.class_code ?? classItem.slug}
            </span>
            {classItem.status !== "active" ? (
              <StatusBadge status={classItem.status} />
            ) : null}
            {classItem.is_admin ? (
              <span className="bg-accent-soft text-accent inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium">
                <Crown
                  aria-hidden="true"
                  className="h-2.5 w-2.5"
                />
                Class Admin
              </span>
            ) : null}
          </div>

          <p className="text-muted-foreground mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            <span className="whitespace-nowrap">
              Semester {classItem.semester} · {classItem.academic_year}
            </span>
            {classItem.admin_name && !classItem.is_admin ? (
              <>
                <MetaDot />
                <span className="max-w-52 truncate">
                  Admin: {classItem.admin_name}
                </span>
              </>
            ) : null}
            <MetaDot />
            <span className="sm:hidden">
              {formatCount(classItem.subject_count)}{" "}
              {pluralize(classItem.subject_count, "subject")}
            </span>
          </p>
        </div>

        <div className="text-muted-foreground hidden shrink-0 items-center gap-3 text-xs sm:flex">
          <span className="whitespace-nowrap">
            <span className="text-foreground font-medium tabular-nums">
              {formatCount(classItem.subject_count)}
            </span>{" "}
            {pluralize(classItem.subject_count, "subject")}
          </span>
          <span className="whitespace-nowrap">
            <span className="text-foreground font-medium tabular-nums">
              {formatCount(classItem.published_count)}
            </span>{" "}
            {pluralize(classItem.published_count, "assignment")}
          </span>
          <span className="whitespace-nowrap">
            <span className="text-foreground font-medium tabular-nums">
              {formatCount(classItem.member_count)}
            </span>{" "}
            {pluralize(classItem.member_count, "member")}
          </span>
        </div>

        <div className="relative z-10 shrink-0">
          <ClassDirectoryMenu
            classSlug={classItem.slug}
            className={classItem.name}
            isAdmin={classItem.is_admin}
          />
        </div>

        <ChevronRight
          aria-hidden="true"
          className="text-muted-foreground/70 h-4 w-4 shrink-0"
        />
      </div>
    </li>
  );
}

export function ClassDirectoryList({
  classes,
  view,
}: {
  classes: ClassDirectoryItem[];
  view: ClassDirectoryView;
}) {
  if (view === "list") {
    return (
      <ul className="divide-border border-border divide-y border-y">
        {classes.map((classItem) => (
          <ClassDirectoryRow
            key={classItem.id}
            classItem={classItem}
          />
        ))}
      </ul>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {classes.map((classItem) => (
        <ClassDirectoryCard
          key={classItem.id}
          classItem={classItem}
        />
      ))}
    </div>
  );
}
