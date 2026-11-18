import { Alert } from "@/components/ui/alert";

/**
 * Shared pending-sync copy for both check-in flows (T3 meeting flow and T4
 * session flow). Server time wins on replay, so an entry captured offline
 * can be rejected as closed once it actually syncs after the window shut.
 */
export function PendingSyncNote({ className }: { className?: string }) {
  return (
    <Alert
      variant="warning"
      className={className}
    >
      <p className="text-xs leading-relaxed">
        Tersimpan, akan tersinkron saat online. Check-in mengikuti waktu server;
        jika window sudah tutup saat sinkron, absen akan ditolak.
      </p>
    </Alert>
  );
}
