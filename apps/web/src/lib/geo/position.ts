/**
 * Browser geolocation helpers shared by the student check-in card and the
 * organizer's room-point picker. The reading is self-reported and always
 * re-validated on the server.
 */
export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("unsupported"));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 0,
    });
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
    return "Your location is unavailable right now. Step outside or near a window and try again.";
  }

  if (code === 3) {
    return "Getting your location took too long. Try again.";
  }

  return "This browser cannot share your location.";
}
