"use client";

import { FileUp, PenLine } from "lucide-react";
import { useSearchParams } from "next/navigation";
import * as React from "react";

import { CreateClassForm } from "@/components/classes/create-class-form";
import { KrsImportForm } from "@/components/classes/krs-import-form";
import { cn } from "@/lib/utils/cn";

type CreateTab = "manual" | "krs";

const TABS: { id: CreateTab; label: string; icon: typeof PenLine }[] = [
  { id: "manual", label: "Manual", icon: PenLine },
  { id: "krs", label: "Import from KRS", icon: FileUp },
];

/**
 * Segmented tab switcher on `/classes/create` toggling between manual class
 * creation and KRS document import.
 */
export function CreateClassTabs() {
  const searchParams = useSearchParams();
  const initialTab: CreateTab =
    searchParams.get("tab") === "krs" ? "krs" : "manual";
  const [activeTab, setActiveTab] = React.useState<CreateTab>(initialTab);

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }

    event.preventDefault();
    const nextIndex =
      event.key === "ArrowRight"
        ? (index + 1) % TABS.length
        : (index - 1 + TABS.length) % TABS.length;
    const nextTab = TABS[nextIndex];

    if (nextTab) {
      setActiveTab(nextTab.id);
    }
  };

  return (
    <div className="mt-6">
      <div
        role="tablist"
        aria-label="Class creation method"
        className="border-border bg-subtle grid grid-cols-2 gap-1 rounded-lg border p-1"
      >
        {TABS.map((tab, index) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={`panel-${tab.id}`}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={cn(
                "focus-visible:outline-accent inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                isSelected
                  ? "bg-surface text-foreground border-border border"
                  : "text-muted-foreground hover:text-foreground border border-transparent",
              )}
            >
              <Icon
                aria-hidden="true"
                className="h-4 w-4 shrink-0"
              />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div
        id="panel-manual"
        role="tabpanel"
        aria-labelledby="tab-manual"
        hidden={activeTab !== "manual"}
      >
        {activeTab === "manual" ? <CreateClassForm /> : null}
      </div>

      <div
        id="panel-krs"
        role="tabpanel"
        aria-labelledby="tab-krs"
        hidden={activeTab !== "krs"}
      >
        {activeTab === "krs" ? <KrsImportForm /> : null}
      </div>
    </div>
  );
}
