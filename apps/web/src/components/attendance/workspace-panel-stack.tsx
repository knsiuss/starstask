"use client";

import { ChevronLeft, X } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

/**
 * One entry of the workspace panel stack.
 *
 * A panel is identified by what it shows rather than by a URL, because the
 * stack lives in client state above the workspace.
 */
export type WorkspacePanel =
  | { kind: "session"; meetingId: string; title: string }
  | { kind: "classAttendance"; title: string };

/**
 * How many detail panels may sit on top of the workspace at once.
 *
 * Opening a panel while the stack is full replaces the deepest one, so the
 * stack keeps a bounded depth instead of growing with every click.
 */
export const MAX_WORKSPACE_PANELS = 2;

type WorkspacePanelStackProps = {
  panels: WorkspacePanel[];
  onBack: () => void;
  onClose: () => void;
  renderPanel: (panel: WorkspacePanel) => React.ReactNode;
};

/**
 * Draws the detail panels above the workspace.
 *
 * Every panel keeps the ones below it visible, so the admin never loses the
 * context of what opened the panel. Only the topmost panel is interactive.
 */
export function WorkspacePanelStack({
  panels,
  onBack,
  onClose,
  renderPanel,
}: WorkspacePanelStackProps) {
  if (panels.length === 0) {
    return null;
  }

  return (
    <>
      {panels.map((panel, index) => {
        const isTop = index === panels.length - 1;
        const isBehind = !isTop;

        return (
          <div
            key={panelKey(panel)}
            className="absolute inset-0 z-20 flex justify-end"
            style={{ zIndex: 20 + index }}
          >
            {isBehind ? (
              <div
                aria-hidden="true"
                className="bg-surface absolute inset-y-0 right-0 w-full max-w-[46rem] translate-x-6 rounded-l-2xl border-l opacity-60 shadow-2xl"
              />
            ) : null}

            <section
              aria-label={panel.title}
              className={cn(
                "bg-surface relative flex h-full w-full max-w-[46rem] flex-col border-l shadow-2xl",
                isBehind && "translate-x-6 opacity-60",
              )}
            >
              <header className="border-border flex items-center gap-2 border-b px-4 py-3">
                {isTop ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={onBack}
                  >
                    <ChevronLeft
                      aria-hidden="true"
                      className="h-4 w-4"
                    />
                    Back
                  </Button>
                ) : null}

                <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {panel.title}
                </h2>

                {isTop ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={onClose}
                    aria-label="Close panel"
                  >
                    <X
                      aria-hidden="true"
                      className="h-4 w-4"
                    />
                  </Button>
                ) : null}
              </header>

              {isTop ? (
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  {renderPanel(panel)}
                </div>
              ) : null}
            </section>
          </div>
        );
      })}
    </>
  );
}

function panelKey(panel: WorkspacePanel): string {
  return panel.kind === "session" ? `session-${panel.meetingId}` : "class";
}

/**
 * Adds a panel to the stack.
 *
 * When the stack is already full the deepest panel is dropped, so the stack
 * keeps a bounded depth instead of piling up another layer.
 */
export function pushWorkspacePanel(
  panels: WorkspacePanel[],
  panel: WorkspacePanel,
): WorkspacePanel[] {
  if (panels.length >= MAX_WORKSPACE_PANELS) {
    return [...panels.slice(1), panel];
  }

  return [...panels, panel];
}

/** Removes the topmost panel, revealing the one below it. */
export function popWorkspacePanel(panels: WorkspacePanel[]): WorkspacePanel[] {
  return panels.slice(0, -1);
}
