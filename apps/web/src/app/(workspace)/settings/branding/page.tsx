import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SetupNotice } from "@/components/layout/setup-notice";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { ExportBrandingForm } from "@/components/branding/export-branding-form";
import { getSessionUser } from "@/lib/auth/session";
import { getClassById, listMyClasses } from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import {
  getBrandingForClass,
  getSeededBranding,
} from "@/features/export-branding/service";

export const metadata: Metadata = {
  title: "Export branding",
  description: "Institutional branding for Excel attendance and grade exports.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function BrandingSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  if (!isSupabaseConfigured()) {
    return (
      <PageShell width="narrow">
        <PageHeader title="Export branding" />
        <div className="mt-6">
          <SetupNotice />
        </div>
      </PageShell>
    );
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath("/settings/branding"));
  }

  const managerClasses = (await listMyClasses(session.user.id))
    .filter((item) => item.status === "active" && item.is_admin)
    .map((item) => ({ id: item.id, slug: item.slug, name: item.name }));

  const params = await searchParams;
  const selected =
    managerClasses.find((item) => item.slug === params.class) ??
    managerClasses[0] ??
    null;

  // listMyClasses does not carry the class institution that seeds the branding
  // defaults, so the selected class is loaded for its institution value.
  const selectedClass = selected ? await getClassById(selected.id) : null;
  const institution = selectedClass?.institution ?? null;

  const branding = selected
    ? await getBrandingForClass(selected.id, { institution })
    : null;
  const seed = selected ? await getSeededBranding({ institution }) : null;

  return (
    <PageShell width="narrow">
      <PageHeader
        title="Export branding"
        description="Branding institusi pada rekap Excel kehadiran dan nilai: kop universitas, fakultas dan prodi, strip alamat, judul dokumen, serta ringkasan nilai dan kelulusan."
      />

      <div className="mt-6">
        {selected && branding && seed ? (
          <ExportBrandingForm
            classes={managerClasses}
            selectedClassSlug={selected.slug}
            initial={branding}
            seed={seed}
          />
        ) : (
          <p className="text-muted-foreground text-sm">
            You do not manage any active class yet. Branding is available to
            class managers.
          </p>
        )}
      </div>
    </PageShell>
  );
}
