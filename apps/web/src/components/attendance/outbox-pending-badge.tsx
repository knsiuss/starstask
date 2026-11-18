"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { buildLoginPath } from "@/lib/security/redirect";
import { cn } from "@/lib/utils/cn";

export type OutboxPendingBadgeProps = {
  count: number;
  sessionExpired: boolean;
  className?: string;
};

const CONTAINER_CLASS =
  "fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-full border border-warning/30 bg-warning-soft px-4 py-2 text-xs font-medium text-warning shadow-sm";

const LINK_CLASS =
  "font-semibold underline underline-offset-2 hover:opacity-80";

/**
 * Persistent pending-check-in badge. Copy never promises delivery: replay
 * can only be attempted while the app is open (no Background Sync on
 * Safari/iOS), and the server may still reject a stale capture once it
 * syncs. Text is plain Indonesian to match the surrounding attendance UI.
 */
export function OutboxPendingBadge({
  count,
  sessionExpired,
  className,
}: OutboxPendingBadgeProps) {
  const pathname = usePathname();

  if (count <= 0) {
    return null;
  }

  if (sessionExpired) {
    const loginPath = buildLoginPath(pathname || "/attendance");

    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(CONTAINER_CLASS, className)}
      >
        <span>Masuk lagi untuk menyinkronkan {count} absen</span>
        <Link
          href={loginPath}
          className={LINK_CLASS}
        >
          Masuk
        </Link>
      </div>
    );
  }

  const onAttendance = pathname.startsWith("/attendance");

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(CONTAINER_CLASS, className)}
    >
      <span>{count} absen menunggu sinkron</span>
      {!onAttendance && (
        <Link
          href="/attendance"
          className={LINK_CLASS}
        >
          Buka absensi
        </Link>
      )}
    </div>
  );
}
