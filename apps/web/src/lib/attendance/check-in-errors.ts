/**
 * Turns the API's stable error code into the copy the check-in card shows.
 *
 * The server owns the decision. This function only decides how to explain a
 * rejection, and never turns a rejection into a success.
 */

// GPS failures have a legitimate manual path: the class admin may mark the
// student present after physically verifying them in the room. Every GPS
// related message points there so a student with a poor signal knows what
// to do instead of retrying forever.
const MANUAL_ATTENDANCE_GUIDANCE =
  "If you are in the room, ask your class admin to mark you present manually — they must physically verify you first.";

export function describeCheckInFailure(
  code: string | undefined,
  fallbackMessage: string | undefined,
): string {
  switch (code) {
    case "checkin_too_far":
      // Intentionally generic: students are not told the distance or the
      // radius, only to go to their class meeting point.
      return `Please go to your class meeting point and try again. ${MANUAL_ATTENDANCE_GUIDANCE}`;
    case "checkin_not_open":
      return "Attendance has not been opened for this meeting yet. Wait for your class admin to open it.";
    case "checkin_closed":
      return "Attendance for this meeting has closed. Ask your class admin if you need a correction.";
    case "checkin_imprecise":
      return `Your location is not accurate enough. Move somewhere with a clearer signal and try again. ${MANUAL_ATTENDANCE_GUIDANCE}`;
    case "checkin_stale_position":
      return `Your location is stale. Move somewhere with a clearer signal and try again. ${MANUAL_ATTENDANCE_GUIDANCE}`;
    case "checkin_unavailable":
    case "checkin_not_scheduled":
      return "This meeting is not open for check-in.";
    case "checkin_name_mismatch":
      return "The name you entered does not match your verified profile. Update your profile first, then try again.";
    case "checkin_nim_mismatch":
      return "The NIM you entered does not match your verified profile. Update your profile first, then try again.";
    case "checkin_identity_missing":
      return "Add your full name and NIM in your profile before checking in.";
    case "forbidden":
      return "Only class members can check in to this meeting.";
    case "geolocation_permission_denied":
      return "Location permission was denied. Allow location access for StarsTask in your browser settings, then try again.";
    case "geolocation_unavailable":
      return `Your device could not determine a location. Move near a window or outdoors and try again. ${MANUAL_ATTENDANCE_GUIDANCE}`;
    case "geolocation_timeout":
      return `Getting your location took too long. Try again, ideally outdoors or near a window. ${MANUAL_ATTENDANCE_GUIDANCE}`;
    case "geolocation_unsupported":
      return "This browser does not support location sharing. Use a modern browser on a phone or laptop.";
    case "geolocation_insecure":
      return "Location sharing needs a secure connection (HTTPS). Open StarsTask over HTTPS and try again.";
    default:
      return fallbackMessage ?? "Could not check you in. Please try again.";
  }
}
