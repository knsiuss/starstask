import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
};

/**
 * Static offline fallback served from the service worker precache.
 * It must stay non-personalized: no session, no Supabase, no user data,
 * so it is safe to precache and safe to serve to anyone on a shared device.
 */
export default function OfflinePage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center sm:px-6">
      <WifiOff
        aria-hidden="true"
        className="text-muted-foreground h-10 w-10"
      />
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        Kamu sedang offline
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        You are offline. Check-in attempts made now are saved on this device and
        sent when the connection returns. They follow server time, so a window
        that has already closed will still reject the check-in.
      </p>
      <p className="text-muted-foreground mt-1 text-sm">
        Kamu sedang offline. Percobaan check-in tersimpan di perangkat ini dan
        dikirim otomatis saat koneksi kembali. Waktu server yang dipakai, jadi
        bila window sudah tutup, absen tetap ditolak.
      </p>
      <div className="mt-6">
        <Button asChild>
          <Link href="/">Kembali ke beranda / Back home</Link>
        </Button>
      </div>
    </div>
  );
}
