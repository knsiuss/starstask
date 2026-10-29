import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(
    "NEXT_PUBLIC_SUPABASE_URL must be a valid URL",
  ),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(20, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY looks too short"),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
});

export type SupabaseConfig = {
  url: string;
  key: string;
};

/** True when the minimum public Supabase configuration is present. */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

/**
 * Reads and validates public Supabase configuration.
 *
 * @throws {Error} when the project URL or publishable key is missing/invalid.
 * Callers should check {@link isSupabaseConfigured} to render a setup notice
 * instead of surfacing this as a crash.
 */
export function getSupabaseConfig(): SupabaseConfig {
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => issue.message)
      .join("; ");

    throw new Error(`Supabase is not configured correctly: ${details}`);
  }

  return {
    url: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    key: parsed.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
