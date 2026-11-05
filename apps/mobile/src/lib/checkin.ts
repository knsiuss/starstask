import { Geolocation } from "@capacitor/geolocation";

import {
  queueOfflineCheckin,
  syncOfflineQueue,
  type PendingCheckIn,
} from "./offline-queue";
import { getSupabase } from "./supabase";

/**
 * GPS check-in for one attendance session (Fase 2).
 *
 * The heavy lifting stays server-side: the `check_in_attendance_meeting`
 * RPC re-validates membership, session state, window, identity, accuracy,
 * and radius, so this module only captures the position and forwards it.
 * When the server cannot be reached, the captured position is queued
 * locally and retried by `syncQueuedCheckIns` once connectivity returns.
 */

export type CheckInResult =
  { ok: true; status: string } | { ok: false; code: string; message: string };

const CHECK_IN_ACCURACY_MAX_M = 100;

type ProfileIdentity = { fullName: string; nim: string };

async function loadIdentity(userId: string): Promise<ProfileIdentity | null> {
  const supabase = getSupabase();

  if (!supabase) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, nim")
    .eq("id", userId)
    .maybeSingle();

  const fullName = (profile?.full_name as string | null)?.trim() ?? "";
  const nim = (profile?.nim as string | null)?.trim() ?? "";

  return fullName && nim ? { fullName, nim } : null;
}

async function sendCheckIn(
  sessionId: string,
  identity: ProfileIdentity,
  latitude: number,
  longitude: number,
  accuracyM: number,
): Promise<CheckInResult> {
  const supabase = getSupabase();

  if (!supabase) {
    return {
      ok: false,
      code: "not_configured",
      message: "Supabase is not configured for this build.",
    };
  }

  const { data, error } = await supabase.rpc("check_in_attendance_meeting", {
    p_session_id: sessionId,
    p_full_name: identity.fullName,
    p_nim: identity.nim,
    p_latitude: latitude,
    p_longitude: longitude,
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

export async function checkInToSession(
  sessionId: string,
  userId: string,
): Promise<CheckInResult> {
  const identity = await loadIdentity(userId);

  if (!identity) {
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

  const result = await sendCheckIn(
    sessionId,
    identity,
    position.coords.latitude,
    position.coords.longitude,
    accuracyM,
  );

  if (result.ok) {
    return result;
  }

  // Server unreachable (or closed window): keep the captured position for
  // the next sync instead of losing the check-in entirely.
  if (!navigator.onLine || result.code === "checkin_failed") {
    queueOfflineCheckin({
      sessionId,
      userId,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracyM,
      fullName: identity.fullName,
      nim: identity.nim,
    });

    return {
      ok: false,
      code: "queued_offline",
      message: "Saved offline — will sync when you are back online.",
    };
  }

  return result;
}

/** Retry every queued check-in; returns how many the server accepted. */
export async function syncQueuedCheckIns(): Promise<number> {
  const { synced } = await syncOfflineQueue(async (item: PendingCheckIn) => {
    const result = await sendCheckIn(
      item.sessionId,
      { fullName: item.fullName, nim: item.nim },
      item.latitude,
      item.longitude,
      item.accuracyM,
    );

    return result.ok;
  });

  return synced;
}
