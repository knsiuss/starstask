"use client";

import Image from "next/image";

import type { ExportBrandingInput } from "@starstask/contracts";

/**
 * Live preview of the Excel header: 3-part block, address strip, and navy
 * title bar, so the settings form shows what the printout will look like.
 */
export function BrandingHeaderPreview({
  branding,
}: {
  branding: ExportBrandingInput;
}) {
  const addressParts = [
    [branding.address, branding.city].filter(Boolean).join(", "),
    branding.officialEmail,
    branding.contactNumber,
    branding.officialWebsite,
  ].filter(Boolean);

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)] items-center gap-3 bg-white px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {branding.universityLogoUrl ? (
            <BrandImage
              src={branding.universityLogoUrl}
              alt="Logo universitas"
            />
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-[#0F172A]">
              {branding.universityName || "Universitas"}
            </p>
            {branding.universityTagline ? (
              <p className="truncate text-[10px] text-slate-500">
                {branding.universityTagline}
              </p>
            ) : null}
          </div>
        </div>
        <div className="min-w-0 text-center">
          <p className="truncate text-xs font-bold text-[#0F172A]">
            {branding.universityName || "Universitas"}
          </p>
          {branding.faculty ? (
            <p className="truncate text-[10px] text-slate-600">
              {branding.faculty}
            </p>
          ) : null}
          {branding.studyProgram ? (
            <p className="truncate text-[10px] text-slate-600">
              {branding.studyProgram}
            </p>
          ) : null}
        </div>
        <div className="flex min-w-0 items-start justify-end gap-2">
          <div className="min-w-0 text-right">
            <p className="truncate text-xs font-bold text-[#0F172A]">
              {branding.productName}
            </p>
            <p className="truncate text-[10px] text-slate-500">
              {branding.productTagline}
            </p>
          </div>
          {branding.productLogoUrl ? (
            <BrandImage
              src={branding.productLogoUrl}
              alt="Logo Aphelion"
            />
          ) : null}
        </div>
      </div>
      <div className="h-1 bg-[#0F172A]" />
      {addressParts.length > 0 ? (
        <p className="bg-white px-4 py-1 text-center text-[10px] text-slate-500">
          {addressParts.join("  |  ")}
        </p>
      ) : null}
      <p className="bg-[#0F172A] px-4 py-2 text-center text-xs font-bold text-white">
        {branding.documentTitle}
      </p>
    </div>
  );
}

function BrandImage({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={36}
      height={36}
      unoptimized
      className="h-9 w-9 shrink-0 object-contain"
    />
  );
}
