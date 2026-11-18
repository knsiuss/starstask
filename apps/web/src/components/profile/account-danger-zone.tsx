"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { AccountDeactivateDialog } from "@/components/profile/account-deactivate-dialog";
import { AccountDeleteDialog } from "@/components/profile/account-delete-dialog";
import { ProfileSection } from "@/components/profile/profile-section";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export type AccountLifecycleState = "active" | "deactivated" | "deleted";

type AccountDangerZoneProps = {
  email: string | null;
  lifecycleState: AccountLifecycleState;
  displayName: string;
};

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      error?: { message?: string };
    } | null;
    return body?.error?.message ?? "Permintaan gagal. Coba lagi.";
  } catch {
    return "Permintaan gagal. Coba lagi.";
  }
}

export function AccountDangerZone({
  email,
  lifecycleState,
  displayName,
}: AccountDangerZoneProps) {
  const router = useRouter();

  const [isReactivating, setIsReactivating] = React.useState(false);
  const [reactivateError, setReactivateError] = React.useState<string | null>(
    null,
  );
  const [reactivateSuccess, setReactivateSuccess] = React.useState(false);
  const [deactivateSuccess, setDeactivateSuccess] = React.useState(false);

  const submitReactivate = async () => {
    if (isReactivating) {
      return;
    }

    setIsReactivating(true);
    setReactivateError(null);
    setReactivateSuccess(false);

    try {
      const response = await fetch("/api/account/reactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });

      if (!response.ok) {
        setReactivateError(await readErrorMessage(response));
        return;
      }

      setReactivateSuccess(true);
      router.refresh();
    } catch {
      setReactivateError("Koneksi bermasalah. Periksa jaringan kamu.");
    } finally {
      setIsReactivating(false);
    }
  };

  if (lifecycleState === "deleted") {
    return (
      <ProfileSection
        id="account"
        title="Account"
      >
        <p className="border-border text-muted-foreground border-t px-5 py-4 text-sm">
          Akun ini telah dihapus.
        </p>
      </ProfileSection>
    );
  }

  return (
    <ProfileSection
      id="account"
      title="Account"
    >
      {deactivateSuccess ? (
        <div className="px-5 pt-4">
          <Alert variant="success">
            Akun kamu sekarang nonaktif. Aktifkan kembali lewat tombol di bawah.
          </Alert>
        </div>
      ) : null}

      {lifecycleState === "deactivated" ? (
        <div className="border-border space-y-3 border-t px-5 py-4">
          <Alert variant="info">
            Akun kamu sedang nonaktif. Workspace diblokir sampai kamu
            mengaktifkan kembali akun.
          </Alert>
          {reactivateSuccess ? (
            <Alert variant="success">Akun kamu aktif kembali.</Alert>
          ) : null}
          {reactivateError ? (
            <Alert variant="error">{reactivateError}</Alert>
          ) : null}
          <div>
            <Button
              type="button"
              variant="primary"
              onClick={() => void submitReactivate()}
              disabled={isReactivating}
              aria-busy={isReactivating}
            >
              {isReactivating ? (
                <Loader2
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin"
                />
              ) : null}
              {isReactivating ? "Memproses..." : "Aktifkan kembali"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-foreground text-sm font-medium">
              Deactivate sementara
            </h3>
            <p className="text-muted-foreground mt-1 max-w-prose text-xs leading-relaxed">
              Akun dinonaktifkan sementara. Data dan histori kelas kamu tetap
              ada. Aktifkan lagi kapan pun dengan masuk kembali.
            </p>
          </div>
          <AccountDeactivateDialog
            email={email}
            onDeactivated={() => {
              setDeactivateSuccess(true);
            }}
          />
        </div>
      )}

      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4">
        <div className="min-w-0">
          <h3 className="text-foreground text-sm font-medium">
            Hapus permanen
          </h3>
          <p className="text-muted-foreground mt-1 max-w-prose text-xs leading-relaxed">
            Akun tidak bisa dipakai lagi. Nama dan NIM kamu tetap tercantum di
            histori kelas; data pribadi (email, foto, bio) dihapus dan akses
            masuk diblokir permanen. Tidak bisa dibatalkan.
          </p>
        </div>
        <AccountDeleteDialog
          email={email}
          displayName={displayName}
          onDeleted={() => undefined}
        />
      </div>
    </ProfileSection>
  );
}
