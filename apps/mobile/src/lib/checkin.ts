import { Geolocation } from "@capacitor/geolocation";

import { getSupabase } from "./supabase";

/**
 * GPS check-in for one attendance session (Fase 2).
 *
 * The heavy lifting stays server-side: the `check_in_attendance_meeting`
 * RPC re-validates membership, session state, window, identity, accuracy,
 * and radius, so this module only captures the position and forwards it.
 * The database default radius applies when the session has no check-in
 * point configured, matching the web flow.
 */

export type CheckInResult =
  { ok: true; status: string } | { ok: false; code: string; message: string };

const CHECK_IN_ACCURACY_MAX_M = 100;

export async function checkInToSession(
  sessionId: string,
  userId: string,
): Promise<CheckInResult> {
  const supabase = getSupabase();

  if (!supabase) {
    return {
      ok: false,
      code: "not_configured",
      message: "Supabase is not configured for this build.",
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, nim")
    .eq("id", userId)
    .maybeSingle();

  const fullName = (profile?.full_name as string | null)?.trim() ?? "";
  const nim = (profile?.nim as string | null)?.trim() ?? "";

  if (!fullName || !nim) {
    return {
      ok: false,
      code: "identity_missing",
      message: "Add your full name and NIM in your profile first.",
    };
  }

  const permission = await Geolocation.requestPermissions();

  if (permission.location !== "granted") {
    return {
      ok: false,
      code: "location_denied",
      message: "Location permission is needed to check in.",
    };
  }

  const position = await Geolocation.getCurrentPosition({
    enableHighAccuracy: true,
    timeout: 10_000,
  });

  const accuracyM = position.coords.accuracy;

  if (accuracyM > CHECK_IN_ACCURACY_MAX_M) {
    return {
      ok: false,
      code: "checkin_imprecise",
      message:
        "Your location reading is not accurate enough. Move somewhere with a clearer signal and try again.",
    };
  }

  const { data, error } = await supabase.rpc("check_in_attendance_meeting", {
    p_session_id: sessionId,
    p_full_name: fullName,
    p_nim: nim,
    p_latitude: position.coords.latitude,
    p_longitude: position.coords.longitude,
    p_accuracy_m: accuracyM,
  });

  if (error) {
    return {
      ok: false,
      code: "checkin_failed",
      message: error.message,
    };
  }

  const result = data as {
    ok?: boolean;
    code?: string;
    message?: string;
    status?: string;
  };

  if (result.ok) {
    return { ok: true, status: result.status ?? "present" };
  }

  return {
    ok: false,
    code: result.code ?? "checkin_failed",
    message: result.message ?? "Check-in failed.",
  };
}
