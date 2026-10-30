"use client";

import {
  AlertCircle,
  CheckCircle2,
  Info,
  X,
  type LucideIcon,
} from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils/cn";

export type ToastVariant = "success" | "error" | "info";

export type ToastOptions = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Milliseconds before auto-dismiss. Errors default to longer. */
  duration?: number;
  action?: { label: string; onClick: () => void };
};

type ToastRecord = {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
  action?: ToastOptions["action"];
};

type ToastContextValue = {
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

const MAX_VISIBLE = 4;
const DEFAULT_DURATION = 5_000;

const VARIANT_STYLES: Record<
  ToastVariant,
  { icon: LucideIcon; iconClassName: string }
> = {
  success: { icon: CheckCircle2, iconClassName: "text-success" },
  error: { icon: AlertCircle, iconClassName: "text-danger" },
  info: { icon: Info, iconClassName: "text-accent" },
};

/**
 * App-wide feedback for actions that finish away from their form.
 *
 * Toasts are deliberately small: one line, an optional description, and at most
 * one action (used for undo). Anything that needs a decision stays a dialog.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastRecord[]>([]);
  const timers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = React.useCallback((id: string) => {
    const timer = timers.current.get(id);

    if (timer) {
      clearTimeout(timer);
    }

    timers.current.delete(id);
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = React.useCallback(
    (options: ToastOptions) => {
      const id = crypto.randomUUID();
      const record: ToastRecord = {
        id,
        title: options.title,
        description: options.description,
        variant: options.variant ?? "info",
        duration: options.duration ?? DEFAULT_DURATION,
        action: options.action,
      };

      // Cap the stack so a burst of failures cannot cover the page.
      setToasts((current) => [...current, record].slice(-MAX_VISIBLE));
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), record.duration),
      );

      return id;
    },
    [dismiss],
  );

  React.useEffect(() => {
    const pendingTimers = timers.current;

    return () => {
      pendingTimers.forEach((timer) => clearTimeout(timer));
      pendingTimers.clear();
    };
  }, []);

  const value = React.useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        // Sits above the mobile tab bar so feedback never hides a control.
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6"
      >
        {toasts.map((item) => {
          const { icon: Icon, iconClassName } = VARIANT_STYLES[item.variant];

          return (
            <div
              key={item.id}
              role={item.variant === "error" ? "alert" : "status"}
              className="border-border bg-surface pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border p-4 shadow-lg"
            >
              <Icon
                aria-hidden="true"
                className={cn("mt-0.5 h-4 w-4 shrink-0", iconClassName)}
              />

              <div className="min-w-0 flex-1">
                <p className="text-foreground text-sm font-medium">
                  {item.title}
                </p>
                {item.description ? (
                  <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                    {item.description}
                  </p>
                ) : null}
                {item.action ? (
                  <button
                    type="button"
                    onClick={() => {
                      item.action?.onClick();
                      dismiss(item.id);
                    }}
                    className="text-accent focus-visible:outline-accent mt-2 rounded text-xs font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    {item.action.label}
                  </button>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss notification"
                className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-accent -mt-1 -mr-1 rounded-md p-1 focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <X
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used inside a ToastProvider");
  }

  return context;
}
