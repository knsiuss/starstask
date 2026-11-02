import { randomUUID } from "node:crypto";

import type { BrowserContext } from "@playwright/test";
import {
  createClient,
  type Session,
  type SupabaseClient,
} from "@supabase/supabase-js";

/**
 * Authenticated end-to-end helpers.
 *
 * These tests only run against a disposable local Supabase stack. They are
 * opt-in through `E2E_SUPABASE_*` variables so an ordinary `pnpm test:e2e`
 * (including the one that may point at a hosted project) never writes data.
 *
 * The app signs users in with Google only, so a browser cannot complete the
 * OAuth ceremony locally. Instead the helper signs a disposable user in over
 * the password grant and writes the exact cookie the SSR client reads back.
 */

const supabaseUrl = process.env.E2E_SUPABASE_URL ?? "";
const anonKey = process.env.E2E_SUPABASE_ANON_KEY ?? "";
const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? "";
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

/** Mirrors @supabase/ssr's chunk size; keep in sync with the pinned version. */
const COOKIE_CHUNK_SIZE = 3_180;

function isLoopback(value: string): boolean {
  try {
    const hostname = new URL(value).hostname;
    return hostname === "127.0.0.1" || hostname === "localhost";
  } catch {
    return false;
  }
}

/** True only when a disposable local stack and a local app are configured. */
export const hasLocalSupabase =
  Boolean(supabaseUrl && anonKey && serviceRoleKey) &&
  isLoopback(supabaseUrl) &&
  isLoopback(baseUrl);

export const testPassword = `test-${randomUUID()}`;
export const suffix = randomUUID().slice(0, 8);

export type E2eUser = {
  id: string;
  email: string;
  session: Session;
  client: SupabaseClient;
};

export function createAdminClient(): SupabaseClient {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Provisions a disposable user with a password so the session can be minted in
 * Node, marks the profile onboarded, and returns the live session.
 */
export async function createE2eUser(
  admin: SupabaseClient,
  label: string,
): Promise<E2eUser> {
  const email = `starstask-e2e-${suffix}-${label}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: testPassword,
    email_confirm: true,
    user_metadata: { full_name: `E2E ${label}` },
  });

  if (error || !data.user) {
    throw new Error(`Could not create E2E user ${label}: ${error?.message}`);
  }

  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signIn, error: signInError } =
    await client.auth.signInWithPassword({ email, password: testPassword });

  if (signInError || !signIn.session) {
    throw new Error(
      `Could not sign in E2E user ${label}: ${signInError?.message}`,
    );
  }

  const { data: profile, error: onboardError } = await admin
    .from("profiles")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", data.user.id)
    .select("id")
    .maybeSingle();

  if (onboardError || !profile) {
    throw new Error(
      `Could not mark E2E user ${label} onboarded: ${
        onboardError?.message ?? "profile row missing"
      }`,
    );
  }

  return { id: data.user.id, email, session: signIn.session, client };
}

/**
 * Serializes the session the way @supabase/ssr stores it: `base64-` followed by
 * the base64url JSON payload, split into `.0`, `.1`, … when too large.
 */
function sessionCookies(session: Session): Array<{
  name: string;
  value: string;
}> {
  const storageKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
  const value = `base64-${Buffer.from(JSON.stringify(session), "utf8").toString(
    "base64url",
  )}`;

  if (encodeURIComponent(value).length <= COOKIE_CHUNK_SIZE) {
    return [{ name: storageKey, value }];
  }

  const chunks: Array<{ name: string; value: string }> = [];

  for (let index = 0; index * COOKIE_CHUNK_SIZE < value.length; index += 1) {
    chunks.push({
      name: `${storageKey}.${index}`,
      value: value.slice(
        index * COOKIE_CHUNK_SIZE,
        (index + 1) * COOKIE_CHUNK_SIZE,
      ),
    });
  }

  return chunks;
}

/** Installs the user's session cookies on a fresh browser context. */
export async function signInBrowser(
  context: BrowserContext,
  user: E2eUser,
): Promise<void> {
  await context.addCookies(
    sessionCookies(user.session).map((cookie) => ({
      ...cookie,
      url: baseUrl,
      httpOnly: false,
      sameSite: "Lax",
    })),
  );
}

/** Runs an RPC and fails the setup loudly with the database's message. */
export async function rpc<T>(
  client: SupabaseClient,
  fn: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await client.rpc(fn, args);

  if (error) {
    throw new Error(`RPC ${fn} failed: ${error.message}`);
  }

  return data as T;
}
