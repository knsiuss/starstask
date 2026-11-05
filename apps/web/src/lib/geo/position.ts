/**
 * Great-circle distance between two coordinates in metres.
 *
 * Mirrors the SQL helper `public.distance_meters` (Haversine, R = 6,371,000).
 * The server always decides; this copy exists so tests can prove the math.
 */
export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.asin(Math.min(1, Math.sqrt(a)));

  return 6_371_000 * c;
}

/**
 * Browser geolocation helpers shared by the student check-in card and the
 * organizer's room-point picker. The reading is self-reported and always
 * re-validated on the server.
 */
export function getCurrentPosition(): Promise<
  GeolocationPosition & { capturedAt: number }
> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("unsupported"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Spread would lose the prototype getters (`coords`, `timestamp`),
        // so copy the fields explicitly.
        resolve({
          coords: position.coords,
          timestamp: position.timestamp,
          capturedAt: position.timestamp,
        } as GeolocationPosition & { capturedAt: number });
      },
      reject,
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  });
}

export function describeGeolocationError(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: number }).code
      : undefined;

  if (code === 1) {
    return "Location permission was denied. Allow it for this site, then try again.";
  }

  if (code === 2) {
    return "Your location is unavailable right now. Step outside or near a window and try again. If you are in the room, ask your class admin to mark you present manually — they must physically verify you first.";
  }

  if (code === 3) {
    return "Getting your location took too long. Try again. If you are in the room, ask your class admin to mark you present manually — they must physically verify you first.";
  }

  return "This browser cannot share your location.";
}
