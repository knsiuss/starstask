export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8 * 1024;

const ALLOWED_DIRECTIVES = new Set([
  "script-src",
  "style-src",
  "img-src",
  "connect-src",
  "frame-src",
  "font-src",
  "worker-src",
  "manifest-src",
  "default-src",
  "frame-ancestors",
  "form-action",
  "object-src",
  "base-uri",
]);

/**
 * CSP violation sink. Accepts no credentials and stores nothing; logs a
 * one-line marker so operators can see probes without persisting payloads
 * (report bodies can echo URLs with tokens).
 */
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (
    !contentType.includes("csp-report") &&
    !contentType.includes("application/json")
  ) {
    return new Response(null, { status: 415 });
  }

  const declared = Number(request.headers.get("content-length") ?? "0");

  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return new Response(null, { status: 413 });
  }

  let body: unknown;

  try {
    const raw = await request.text();

    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
      return new Response(null, { status: 413 });
    }

    body = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }

  const report =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};

  const reportObject =
    typeof report["csp-report"] === "object" && report["csp-report"] !== null
      ? (report["csp-report"] as Record<string, unknown>)
      : report;

  const effectiveDirective =
    typeof reportObject["effective-directive"] === "string"
      ? (reportObject["effective-directive"] as string).slice(0, 40)
      : typeof reportObject["violated-directive"] === "string"
        ? (reportObject["violated-directive"] as string).split(/\s/)[0]?.slice(0, 40)
        : null;

  const blocked =
    typeof reportObject["blocked-uri"] === "string"
      ? reportObject["blocked-uri"].split(/[?#]/)[0]?.slice(0, 120)
      : null;

  const sourceFile =
    typeof reportObject["source-file"] === "string"
      ? reportObject["source-file"].split(/[?#]/)[0]?.slice(0, 120)
      : null;

  if (effectiveDirective && ALLOWED_DIRECTIVES.has(effectiveDirective)) {
    console.warn("[csp-report]", {
      directive: effectiveDirective,
      blocked,
      sourceFile,
    });
  }

  return new Response(null, { status: 204 });
}
