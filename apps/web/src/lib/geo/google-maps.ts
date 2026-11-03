/**
 * Google Maps link parsing and resolution.
 *
 * Only the patterns below are recognized; anything else returns null so the
 * caller can fall back to manual coordinates rather than guess.
 */
export type GoogleMapsPoint = {
  latitude: number;
  longitude: number;
};

const COORDINATE_PAIR =
  /(-?\d{1,2}(?:\.\d+)?)\s*(?:,|%2C|\s)\s*(-?\d{1,3}(?:\.\d+)?)/i;
const EMBED_3D_4D = /!3d(-?\d{1,2}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/;
const ATTR_TUPLE = /@(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/;
const LAT_LNG_JSON =
  /"lat(?:itude)?"\s*:\s*(-?\d{1,2}(?:\.\d+)?)[^}]{0,40}?"l(?:ongitude|ng|ocation)"\s*:\s*(-?\d{1,3}(?:\.\d+)?)/;
const LL_PARAM =
  /[?&](?:ll|center|sll|m+=)=?(-?\d{1,2}(?:\.\d+)?)[,%2C]\s*(-?\d{1,3}(?:\.\d+)?)/i;

export function isAllowedGoogleMapsHost(rawUrl: string): boolean {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") {
    return false;
  }

  const host = url.hostname.toLowerCase();

  if (host === "maps.app.goo.gl" || host === "goo.gl") {
    return true;
  }

  return (
    host === "google.com" ||
    host.endsWith(".google.com") ||
    /^maps\.google\.[a-z.]{2,}$/.test(host) ||
    /^www\.google\.[a-z.]{2,}$/.test(host)
  );
}

function clampLatitude(value: number): number | null {
  return Number.isFinite(value) && Math.abs(value) <= 90 ? value : null;
}

function clampLongitude(value: number): number | null {
  return Number.isFinite(value) && Math.abs(value) <= 180 ? value : null;
}

function pointFromPair(
  latitude: string,
  longitude: string,
): GoogleMapsPoint | null {
  const lat = clampLatitude(Number(latitude));
  const lng = clampLongitude(Number(longitude));

  return lat === null || lng === null
    ? null
    : { latitude: lat, longitude: lng };
}

/** Extracts coordinates from a URL that already carries them. */
export function parseGoogleMapsUrl(rawUrl: string): GoogleMapsPoint | null {
  const candidates = [rawUrl, decodeURIComponent(rawUrl)];

  for (const candidate of candidates) {
    const embed = EMBED_3D_4D.exec(candidate);

    if (embed) {
      const point = pointFromPair(embed[1] ?? "", embed[2] ?? "");

      if (point) {
        return point;
      }
    }

    const at = ATTR_TUPLE.exec(candidate);

    if (at) {
      const point = pointFromPair(at[1] ?? "", at[2] ?? "");

      if (point) {
        return point;
      }
    }

    const ll = LL_PARAM.exec(candidate);

    if (ll) {
      const point = pointFromPair(ll[1] ?? "", ll[2] ?? "");

      if (point) {
        return point;
      }
    }

    const llRaw = COORDINATE_PAIR.exec(candidate);

    if (llRaw && /(maps|search|place)/i.test(candidate)) {
      const point = pointFromPair(llRaw[1] ?? "", llRaw[2] ?? "");

      if (point) {
        return point;
      }
    }
  }

  return null;
}

/**
 * Extracts coordinates embedded in the returned HTML document. Search pages
 * ship an inline JSON blob with the place coordinates; `!3d!4d` markers are
 * also present in the place hrefs.
 */
export function parseGoogleMapsHtml(html: string): GoogleMapsPoint | null {
  const embed = EMBED_3D_4D.exec(html);

  if (embed) {
    const point = pointFromPair(embed[1] ?? "", embed[2] ?? "");

    if (point) {
      return point;
    }
  }

  const latLng = LAT_LNG_JSON.exec(html);

  if (latLng) {
    const point = pointFromPair(latLng[1] ?? "", latLng[2] ?? "");

    if (point) {
      return point;
    }
  }

  const at = ATTR_TUPLE.exec(html);

  if (at) {
    return pointFromPair(at[1] ?? "", at[2] ?? "");
  }

  return null;
}

/** Strips the boilerplate suffix Google puts in every page title. */
export function parseGoogleMapsTitle(html: string): string | null {
  const match = /<title>([^<]{2,300})<\/title>/i.exec(html);

  if (!match?.[1]) {
    return null;
  }

  const title = match[1]
    .replace(/\s*[-–|]\s*Google Maps?\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  return title.length >= 2 ? title : null;
}

/** Restricts which redirect targets the resolver will follow. */
export function isSafeRedirectTarget(rawUrl: string): boolean {
  return isAllowedGoogleMapsHost(rawUrl);
}
