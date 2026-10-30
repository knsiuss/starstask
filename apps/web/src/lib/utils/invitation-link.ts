/**
 * Tokens are generated as base64url from a CSPRNG, so they only ever contain
 * URL-safe characters. Matching that shape lets a bad paste fail here with a
 * readable message instead of landing on `/invite/undefined`.
 */
const INVITATION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,200}$/;

const INVITE_PATH_PREFIX = "/invite/";

/**
 * Reads an invitation token from either a bare token or a pasted invite link.
 *
 * Returns `null` when the value carries no usable token, which the caller
 * turns into a validation message rather than a redirect.
 */
export function extractInvitationToken(value: string): string | null {
  const trimmed = value.trim();

  if (trimmed === "") {
    return null;
  }

  const fromPath = extractFromPath(invitePath(trimmed));

  if (fromPath) {
    return fromPath;
  }

  return INVITATION_TOKEN_PATTERN.test(trimmed) ? trimmed : null;
}

/** Path of an absolute URL, a protocol-relative link, or a site-relative link. */
function invitePath(value: string): string | null {
  if (value.startsWith(INVITE_PATH_PREFIX)) {
    return value;
  }

  const candidates = value.startsWith("//") ? [`https:${value}`] : [value];

  for (const candidate of candidates) {
    try {
      return new URL(candidate).pathname;
    } catch {
      continue;
    }
  }

  return null;
}

function extractFromPath(path: string | null): string | null {
  if (!path) {
    return null;
  }

  const markerIndex = path.indexOf(INVITE_PATH_PREFIX);

  if (markerIndex === -1) {
    return null;
  }

  const remainder = path.slice(markerIndex + INVITE_PATH_PREFIX.length);
  const token = remainder.split("/")[0] ?? "";

  return INVITATION_TOKEN_PATTERN.test(token) ? token : null;
}
