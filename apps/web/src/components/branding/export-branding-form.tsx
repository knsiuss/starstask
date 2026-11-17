"use client";

import { Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  exportBrandingSchema,
  toFieldErrors,
  type ExportBrandingInput,
} from "@starstask/contracts";

import { BrandingHeaderPreview } from "@/components/branding/branding-header-preview";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

export type ManagerClassOption = {
  id: string;
  slug: string;
  name: string;
};

type TextFieldDef = {
  key: keyof ExportBrandingInput & string;
  label: string;
  hint?: string;
  inputType?: "text" | "email" | "url";
};

const INSTITUTION_FIELDS: TextFieldDef[] = [
  { key: "universityName", label: "Nama universitas" },
  { key: "universityShortName", label: "Singkatan universitas" },
  { key: "universityTagline", label: "Tagline universitas" },
  { key: "faculty", label: "Fakultas" },
  { key: "department", label: "Departemen / Jurusan" },
  { key: "studyProgram", label: "Program studi" },
];

const CONTACT_FIELDS: TextFieldDef[] = [
  { key: "address", label: "Alamat" },
  { key: "city", label: "Kota" },
  { key: "officialWebsite", label: "Website resmi", inputType: "url" },
  { key: "officialEmail", label: "Email resmi", inputType: "email" },
  { key: "contactNumber", label: "Nomor kontak" },
];

const DOCUMENT_FIELDS: TextFieldDef[] = [
  { key: "documentTitle", label: "Judul dokumen" },
  { key: "footerText", label: "Teks footer" },
];

const PRODUCT_FIELDS: TextFieldDef[] = [
  { key: "productName", label: "Nama produk" },
  { key: "productTagline", label: "Tagline produk" },
  { key: "productFooter", label: "Footer produk" },
];

/**
 * Settings form for one class's export branding.
 *
 * Server-rendered with the effective config (saved row or seeded defaults)
 * plus a fresh seed for "Restore defaults". Saves through the class branding
 * API; logo URLs come from the logo upload endpoint.
 */
export function ExportBrandingForm({
  classes,
  selectedClassSlug,
  initial,
  seed,
}: {
  classes: ManagerClassOption[];
  selectedClassSlug: string;
  initial: ExportBrandingInput;
  seed: ExportBrandingInput;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [values, setValues] = React.useState(initial);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [uploadingKind, setUploadingKind] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const uploadKindRef = React.useRef<"university" | "product">("university");

  const update = (key: keyof ExportBrandingInput, value: string) => {
    setValues((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => {
      if (!previous[key]) {
        return previous;
      }

      const next = { ...previous };
      delete next[key];
      return next;
    });
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (saving) {
      return;
    }

    setFormError(null);
    const parsed = exportBrandingSchema.safeParse(values);

    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        `/api/classes/${encodeURIComponent(selectedClassSlug)}/branding`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        },
      );
      const body = (await response.json()) as {
        data?: { branding?: ExportBrandingInput };
        error?: { message?: string; fieldErrors?: Record<string, string> };
      };

      if (!response.ok) {
        setErrors(body.error?.fieldErrors ?? {});
        setFormError(body.error?.message ?? "Could not save branding.");
        return;
      }

      if (body.data?.branding) {
        setValues(body.data.branding);
      }

      toast({ title: "Branding saved.", variant: "success" });
      router.refresh();
    } catch {
      setFormError("Network error. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const pickUpload = (kind: "university" | "product") => {
    uploadKindRef.current = kind;
    fileRef.current?.click();
  };

  const handleLogoFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const kind = uploadKindRef.current;
    setUploadingKind(kind);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", kind);
      const response = await fetch(
        `/api/classes/${encodeURIComponent(selectedClassSlug)}/branding/logo`,
        { method: "POST", body: formData },
      );
      const body = (await response.json()) as {
        data?: { url?: string };
        error?: { message?: string };
      };

      if (!response.ok || !body.data?.url) {
        throw new Error(body.error?.message ?? "Could not upload the logo.");
      }

      update(
        kind === "product" ? "productLogoUrl" : "universityLogoUrl",
        body.data.url,
      );
      toast({ title: "Logo uploaded.", variant: "success" });
    } catch (error) {
      toast({
        variant: "error",
        title: error instanceof Error ? error.message : "Upload failed",
      });
    } finally {
      setUploadingKind(null);
    }
  };

  return (
    <form
      onSubmit={(event) => void handleSave(event)}
      noValidate
      className="space-y-6"
    >
      <input
        ref={fileRef}
        type="file"
        accept=".png,.jpg,.jpeg"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => void handleLogoFile(event)}
      />

      <div>
        <Label htmlFor="branding-class">Kelas</Label>
        <Select
          id="branding-class"
          value={selectedClassSlug}
          onChange={(event) =>
            router.push(`/settings/branding?class=${event.target.value}`)
          }
          className="mt-1.5"
        >
          {classes.map((item) => (
            <option
              key={item.id}
              value={item.slug}
            >
              {item.name}
            </option>
          ))}
        </Select>
      </div>

      <BrandingHeaderPreview branding={values} />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={values.brandingEnabled}
          onChange={(event) =>
            setValues((previous) => ({
              ...previous,
              brandingEnabled: event.target.checked,
            }))
          }
          className="h-4 w-4"
        />
        Gunakan branding resmi pada export
      </label>

      <FieldSection
        title="Institusi"
        fields={INSTITUTION_FIELDS}
        {...{ values, errors, update }}
      />

      <FieldSection
        title="Alamat & Kontak"
        fields={CONTACT_FIELDS}
        {...{ values, errors, update }}
      />

      <FieldSection
        title="Dokumen"
        fields={DOCUMENT_FIELDS}
        {...{ values, errors, update }}
      />

      <FieldSection
        title="Produk"
        fields={PRODUCT_FIELDS}
        {...{ values, errors, update }}
      />

      <div>
        <Label htmlFor="passingThreshold">Batas kelulusan</Label>
        <Input
          id="passingThreshold"
          type="number"
          min={0}
          max={100}
          step={1}
          value={values.passingThreshold}
          onChange={(event) =>
            setValues((previous) => ({
              ...previous,
              passingThreshold: Number(event.target.value),
            }))
          }
          className="mt-1.5"
        />
        {errors.passingThreshold ? (
          <p className="text-danger mt-1 text-xs">{errors.passingThreshold}</p>
        ) : (
          <p className="text-muted-foreground mt-1 text-xs">
            Nilai Akhir di bawah ini dihitung tidak lulus (0–100).
          </p>
        )}
      </div>

      <div className="space-y-4">
        <LogoField
          id="universityLogo"
          label="Logo universitas"
          value={values.universityLogoUrl}
          uploading={uploadingKind === "university"}
          onUpload={() => pickUpload("university")}
          onChange={(value) => update("universityLogoUrl", value)}
        />
        <LogoField
          id="productLogo"
          label="Logo produk"
          value={values.productLogoUrl}
          uploading={uploadingKind === "product"}
          onUpload={() => pickUpload("product")}
          onChange={(value) => update("productLogoUrl", value)}
        />
      </div>

      {formError ? <Alert variant="error">{formError}</Alert> : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={saving}
          aria-busy={saving}
        >
          {saving ? (
            <Loader2
              aria-hidden="true"
              className="h-4 w-4 animate-spin"
            />
          ) : null}
          {saving ? "Menyimpan..." : "Simpan"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={saving}
          onClick={() => {
            setValues(seed);
            setErrors({});
            setFormError(null);
          }}
        >
          Restore defaults
        </Button>
      </div>
    </form>
  );
}

function FieldSection({
  title,
  fields,
  values,
  errors,
  update,
}: {
  title: string;
  fields: TextFieldDef[];
  values: ExportBrandingInput;
  errors: Record<string, string>;
  update: (key: keyof ExportBrandingInput, value: string) => void;
}) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-semibold">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.key}>
            <Label htmlFor={`branding-${field.key}`}>{field.label}</Label>
            <Input
              id={`branding-${field.key}`}
              type={field.inputType ?? "text"}
              value={(values[field.key] as string | null) ?? ""}
              onChange={(event) => update(field.key, event.target.value)}
              aria-invalid={Boolean(errors[field.key])}
              className="mt-1.5"
            />
            {errors[field.key] ? (
              <p className="text-danger mt-1 text-xs">{errors[field.key]}</p>
            ) : field.hint ? (
              <p className="text-muted-foreground mt-1 text-xs">{field.hint}</p>
            ) : null}
          </div>
        ))}
      </div>
    </fieldset>
  );
}

function LogoField({
  id,
  label,
  value,
  uploading,
  onUpload,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  uploading: boolean;
  onUpload: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <Input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://… atau /path-logo.png"
          className="min-w-0 flex-1"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={uploading}
          aria-busy={uploading}
          onClick={onUpload}
        >
          {uploading ? (
            <Loader2
              aria-hidden="true"
              className="h-4 w-4 animate-spin"
            />
          ) : (
            <Upload
              aria-hidden="true"
              className="h-4 w-4"
            />
          )}
          Upload
        </Button>
      </div>
      <p className="text-muted-foreground mt-1 text-xs">
        PNG/JPG ≤ 2 MB. Simpan untuk memakai logo terunggah.
      </p>
    </div>
  );
}
