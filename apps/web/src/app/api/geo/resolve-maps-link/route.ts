import { z } from "zod";

import { ApiError, serviceUnavailable, unauthorized } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import {
  isAllowedGoogleMapsHost,
  isSafeRedirectTarget,
  parseGoogleMapsHtml,
  parseGoogleMapsTitle,
  parseGoogleMapsUrl,
} from "@/lib/geo/google-maps";

export const dynamic = "force-dynamic";

const MAX_REDIRECTS = 5;
const MAX_HTML_BYTES = 512 * 1024;
const FETCH_TIMEOUT_MS = 8_000;

const bodySchema = z
  .object({
    url: z.string().trim().max(2_048),
  })
  .strict();

/**
 * Resolves a Google Maps share link to coordinates.
 *
 * The link is only ever fetched server-side and only Google's own hosts are
 * contacted, so the route cannot be used as an open proxy. A coordinate in
 * the URL short-circuits the fetch entirely.
 */
export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await getSessionUser();

    if (!session) {
      throw unauthorized();
    }

    await enforceRateLimit({
      action: "geo:maps-resolve",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 3_600,
    });

    const rawBody = await readJsonBody(request);
    const parsed = bodySchema.safeParse(rawBody);

    if (!parsed.success) {
      throw new ApiError(
        400,
        "invalid_url",
        "Paste a Google Maps link, or enter the coordinates manually.",
      );
    }

    const url = parsed.data.url.trim();

    if (!isAllowedGoogleMapsHost(url)) {
      throw new ApiError(
        422,
        "maps_link_not_allowed",
        "That is not a Google Maps link. Paste a link from Google Maps, or enter the coordinates manually.",
      );
    }

    const direct = parseGoogleMapsUrl(url);

    if (direct) {
      return apiSuccess({ ...direct, name: null, resolvedFrom: "url" });
    }

    const resolved = await resolveWithFetch(url);

    if (!resolved) {
      throw new ApiError(
        422,
        "maps_resolve_failed",
        "That link could not be resolved here. Enter latitude and longitude manually, or try a full Google Maps link.",
      );
    }

    return apiSuccess(resolved);
  } catch (error) {
    return handleRouteError(error);
  }
}

async function readJsonBody(request: Request): Promise<unknown> {
  const raw = await request.text().catch(() => null);

  if (!raw) {
    throw new ApiError(
      400,
      "invalid_json",
      "The request body could not be read.",
    );
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError(
      400,
      "invalid_json",
      "The request body could not be read.",
    );
  }
}

type ResolvedPoint = {
  latitude: number;
  longitude: number;
  name: string | null;
  resolvedFrom: "link" | "page";
};

async function resolveWithFetch(
  initialUrl: string,
): Promise<ResolvedPoint | null> {
  let current = initialUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const body = await fetchLimited(current);

    if (!body || typeof body !== "object") {
      return null;
    }

    if ("redirectTo" in body) {
      if (!isSafeRedirectTarget(body.redirectTo)) {
        return null;
      }

      current = body.redirectTo;
      continue;
    }

    // Final page: prefer coordinates already present in the URL chain.
    const atFinal = parseGoogleMapsUrl(current);

    if (atFinal) {
      return {
        ...atFinal,
        name: parseGoogleMapsTitle(body.html) ?? null,
        resolvedFrom: "link",
      };
    }

    const fromHtml = parseGoogleMapsHtml(body.html);

    if (!fromHtml) {
      return null;
    }

    return {
      ...fromHtml,
      name: parseGoogleMapsTitle(body.html) ?? null,
      resolvedFrom: "page",
    };
  }

  return null;
}

async function fetchLimited(
  url: string,
): Promise<{ redirectTo: string } | { html: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent":
          "Mozilla/5.0 (compatible; StarsTask/1.0; +https://starstask.app)",
      },
    });

    const location = response.headers.get("location");

    if (response.status >= 300 && response.status < 400 && location) {
      const absolute = new URL(location, url).toString();

      return { redirectTo: absolute };
    }

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (
      contentType.length > 0 &&
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml")
    ) {
      return null;
    }

    const contentLength = Number(response.headers.get("content-length") ?? "0");

    if (Number.isFinite(contentLength) && contentLength > MAX_HTML_BYTES) {
      return null;
    }

    const html = (await response.text()).slice(0, MAX_HTML_BYTES);

    return { html };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
