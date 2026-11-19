import { ArrowLeft, GraduationCap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  LecturerCreateForm,
  type LecturerUniversityOption,
} from "@/components/classes/lecturer-create-form";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { isLecturer } from "@/lib/auth/lecturer";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Buat kelas (lecturer)",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Reads the active lecturer/university_admin memberships of the signed-in user
 * so the picker can name the universities involved. Returns an empty list on
 * any failure; the caller then falls back to the RPC's own membership
 * resolution (single membership succeeds, multiple memberships surface the
 * pick_university error with the `/settings/profile` fallback).
 */
async function listLecturerUniversityOptions(): Promise<
  LecturerUniversityOption[]
> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: memberships, error: membershipError } = await supabase
      .from("university_memberships")
      .select("university_id")
      .eq("status", "active")
      .in("role", ["lecturer", "university_admin"]);

    if (membershipError) {
      return [];
    }

    const universityIds = [
      ...new Set((memberships ?? []).map((row) => row.university_id)),
    ];

    if (universityIds.length === 0) {
      return [];
    }

    const { data: universities, error: universityError } = await supabase
      .from("universities")
      .select("id, name")
      .in("id", universityIds)
      .eq("status", "active")
      .order("name", { ascending: true });

    if (universityError) {
      return [];
    }

    return (universities ?? []).map((row) => ({ id: row.id, name: row.name }));
  } catch {
    return [];
  }
}

export default async function CreateLecturerClassPage() {
  if (!isSupabaseConfigured()) {
    return (
      <PageShell width="form">
        <SetupNotice />
      </PageShell>
    );
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath("/classes/create-lecturer"));
  }

  const lecturer = await isLecturer();

  if (!lecturer) {
    return (
      <PageShell width="form">
        <Link
          href="/classes"
          className="text-muted-foreground hover:text-foreground focus-visible:outline-accent inline-flex min-h-11 items-center gap-1.5 rounded-sm text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <ArrowLeft
            aria-hidden="true"
            className="h-4 w-4"
          />
          My Classes
        </Link>
        <PageHeader
          title="Buat kelas (lecturer)"
          description="Hanya persona lecturer yang bisa membuat kelas langsung dari halaman ini."
          className="mt-4"
        />
        <Alert
          variant="warning"
          className="mt-6"
        >
          Akun kamu belum dikenali sebagai lecturer. Persona ini aktif otomatis
          kalau email kamu cocok dengan domain institusi yang terdaftar, atau
          bisa kamu klaim manual lewat profil.
        </Alert>
        <div className="mt-4">
          <Button
            asChild
            variant="secondary"
            size="sm"
          >
            <Link href="/settings/profile#lecturer">
              Klaim atau cek persona lecturer
            </Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  const universityOptions = await listLecturerUniversityOptions();

  return (
    <PageShell width="form">
      <Link
        href="/classes"
        className="text-muted-foreground hover:text-foreground focus-visible:outline-accent inline-flex min-h-11 items-center gap-1.5 rounded-sm text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        My Classes
      </Link>

      <PageHeader
        title="Buat kelas (lecturer)"
        description="Kelas langsung aktif dan kamu jadi class admin dengan izin kelola penuh. Mahasiswa bergabung lewat undangan kelas, bukan lewat antrian persetujuan."
        className="mt-4"
        actions={
          <span className="bg-accent-soft text-accent flex h-11 w-11 items-center justify-center rounded-md">
            <GraduationCap
              aria-hidden="true"
              className="h-5 w-5"
            />
          </span>
        }
      />

      <LecturerCreateForm
        canSubmit
        universityOptions={universityOptions}
      />
    </PageShell>
  );
}
