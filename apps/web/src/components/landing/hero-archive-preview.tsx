"use client";

import { ArrowUpRight, FolderOpen } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { buildAssignmentsHref } from "@/lib/assignments/urls";
import { cn } from "@/lib/utils/cn";

type SubjectPreview = {
  id: string;
  label: string;
  search: string;
  items: readonly {
    code: string;
    title: string;
    tags: readonly string[];
    width: string;
  }[];
};

const SUBJECT_PREVIEWS: readonly SubjectPreview[] = [
  {
    id: "cs",
    label: "Computer Science",
    search: "computer",
    items: [
      {
        code: "CS-01",
        title: "Algorithm & complexity brief",
        tags: ["Prompt", "Rubric"],
        width: "w-11/12",
      },
      {
        code: "CS-02",
        title: "Systems architecture spec",
        tags: ["PDF", "Deadline"],
        width: "w-4/5",
      },
      {
        code: "CS-03",
        title: "Database schema deliverable",
        tags: ["Starter", "Tags"],
        width: "w-3/4",
      },
    ],
  },
  {
    id: "eng",
    label: "Engineering",
    search: "engineering",
    items: [
      {
        code: "ENG-01",
        title: "Lab measurement protocol",
        tags: ["Prompt", "PDF"],
        width: "w-10/12",
      },
      {
        code: "ENG-02",
        title: "CAD assembly specification",
        tags: ["Rubric", "Files"],
        width: "w-5/6",
      },
      {
        code: "ENG-03",
        title: "Technical report structure",
        tags: ["Deadline", "Tags"],
        width: "w-2/3",
      },
    ],
  },
  {
    id: "biz",
    label: "Business",
    search: "business",
    items: [
      {
        code: "BIZ-01",
        title: "Case study analysis brief",
        tags: ["Prompt", "Rubric"],
        width: "w-11/12",
      },
      {
        code: "BIZ-02",
        title: "Market sizing deliverable",
        tags: ["Dataset", "PDF"],
        width: "w-3/4",
      },
      {
        code: "BIZ-03",
        title: "Team presentation outline",
        tags: ["Deadline", "Links"],
        width: "w-2/3",
      },
    ],
  },
  {
    id: "math",
    label: "Mathematics",
    search: "math",
    items: [
      {
        code: "MTH-01",
        title: "Proof set & notation guide",
        tags: ["Prompt", "PDF"],
        width: "w-10/12",
      },
      {
        code: "MTH-02",
        title: "Linear modeling problem sheet",
        tags: ["Rubric", "Starter"],
        width: "w-4/5",
      },
      {
        code: "MTH-03",
        title: "Statistical inference brief",
        tags: ["Dataset", "Tags"],
        width: "w-3/5",
      },
    ],
  },
];

export function HeroArchivePreview() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [pillStyle, setPillStyle] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });
  const tablistRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const active = SUBJECT_PREVIEWS[activeIndex] ?? SUBJECT_PREVIEWS[0];

  useEffect(() => {
    const updatePill = () => {
      const container = tablistRef.current;
      const activeButton = tabRefs.current[activeIndex];

      if (!container || !activeButton) {
        return;
      }

      setPillStyle({
        left: activeButton.offsetLeft,
        width: activeButton.offsetWidth,
      });
    };

    updatePill();

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(updatePill)
        : null;

    if (observer && tablistRef.current) {
      observer.observe(tablistRef.current);
    }

    return () => observer?.disconnect();
  }, [activeIndex]);

  if (!active) {
    return null;
  }

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
      return;
    }

    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const next =
      (index + direction + SUBJECT_PREVIEWS.length) % SUBJECT_PREVIEWS.length;

    setActiveIndex(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="border-border bg-surface overflow-hidden rounded-2xl border text-left shadow-[0_24px_60px_-15px_rgba(9,9,11,0.12)] dark:shadow-[0_24px_60px_-15px_rgba(0,0,0,0.45)]">
      <div className="border-border bg-surface/85 flex flex-col gap-3 border-b px-4 py-3 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-2">
          <FolderOpen
            aria-hidden="true"
            className="text-accent h-4 w-4 shrink-0"
          />
          <span className="text-foreground font-mono text-xs font-medium">
            archive / {active.search}
          </span>
        </div>

        <div
          ref={tablistRef}
          role="tablist"
          aria-label="Preview by subject"
          className="bg-muted/70 relative grid w-full grid-cols-2 gap-1.5 rounded-lg p-1 sm:flex sm:w-auto sm:items-center sm:gap-1"
        >
          {pillStyle.width > 0 ? (
            <span
              aria-hidden="true"
              style={{
                transform: `translateX(${pillStyle.left - 4}px)`,
                width: `${pillStyle.width}px`,
              }}
              className="bg-surface border-border/80 pointer-events-none absolute top-1 bottom-1 left-1 hidden rounded-md border transition-[transform,width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] sm:block"
            />
          ) : null}

          {SUBJECT_PREVIEWS.map((subject, index) => {
            const isSelected = index === activeIndex;

            return (
              <button
                key={subject.id}
                ref={(el) => {
                  tabRefs.current[index] = el;
                }}
                type="button"
                role="tab"
                id={`preview-tab-${subject.id}`}
                tabIndex={isSelected ? 0 : -1}
                aria-selected={isSelected}
                aria-controls={`preview-panel-${subject.id}`}
                onClick={() => setActiveIndex(index)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                className={cn(
                  "focus-visible:outline-accent relative z-10 min-h-9 cursor-pointer truncate rounded-md px-2.5 py-1.5 text-center text-xs font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 sm:min-h-8",
                  isSelected
                    ? "bg-surface text-foreground border-border border sm:border-transparent sm:bg-transparent"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {subject.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        key={active.id}
        role="tabpanel"
        id={`preview-panel-${active.id}`}
        aria-labelledby={`preview-tab-${active.id}`}
        className="st-panel-enter divide-border divide-y"
      >
        {active.items.map((item, rowIndex) => (
          <div
            key={item.code}
            style={{ animationDelay: `${rowIndex * 55}ms` }}
            className="st-fade-up hover:bg-subtle/50 grid gap-3 px-4 py-4 transition-colors duration-200 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5"
          >
            <div className="min-w-0 space-y-2">
              <div className="flex items-center gap-2.5">
                <span className="text-accent font-mono text-[11px] font-semibold">
                  {item.code}
                </span>
                <span className="text-foreground truncate text-sm font-medium">
                  {item.title}
                </span>
              </div>
              <div className="bg-muted h-1.5 w-full max-w-md overflow-hidden rounded-full">
                <div
                  style={{ animationDelay: `${rowIndex * 70 + 80}ms` }}
                  className={cn(
                    "st-bar-grow bg-accent/65 h-full rounded-full",
                    item.width,
                  )}
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="border-border bg-subtle text-muted-foreground rounded-md border px-2 py-0.5 text-[11px]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ))}

        <div className="bg-subtle/60 flex flex-wrap items-center justify-between gap-2 px-4 py-3.5 sm:px-5">
          <span className="text-muted-foreground text-xs">
            Sign in with Google to open full briefs
          </span>
          <Link
            href={buildAssignmentsHref({ search: active.search })}
            className="text-accent group inline-flex items-center gap-1 text-xs font-medium hover:underline"
          >
            Open {active.label}
            <ArrowUpRight
              aria-hidden="true"
              className="h-3.5 w-3.5 transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </Link>
        </div>
      </div>
    </div>
  );
}
