package id.starstask.mobile.ui.screens

// Check-in validation helpers (web contracts/sessions.ts). Extracted from AttendanceCheckInCards.

val SESSION_CHECKIN_ACCURACY_MAX_M = 100.0 // web contracts/sessions.ts SESSION_CHECKIN_ACCURACY_MAX_M

val NIM_PATTERN = Regex("^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$")

val STALE_LOCATION_MSG =
    "Your location is stale. Move somewhere with a clearer signal and try again. If you are in the room, ask your class admin to mark you present manually — they must physically verify you first."

fun accuracyMsg(accuracy: Double): String =
    "Your GPS signal is not accurate enough (about ${accuracy.toInt()} m). Move to an area with a clearer signal and try again. If you are in the room, ask your class admin to mark you present manually — they must physically verify you first."
