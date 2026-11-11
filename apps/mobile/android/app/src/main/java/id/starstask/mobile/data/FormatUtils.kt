package id.starstask.mobile.data

/** Date/time formatting + JSON null helper shared by all data files. */

fun deviceDate(iso: String): String =
    try {
        java.time.OffsetDateTime.parse(iso)
            .atZoneSameInstant(DEVICE_ZONE)
            .toLocalDate().toString()
    } catch (_: Exception) {
        iso.substring(0, 10)
    }

fun formatTime(iso: String): String =
    try {
        java.time.OffsetDateTime.parse(iso)
            .atZoneSameInstant(DEVICE_ZONE)
            .toLocalTime().format(java.time.format.DateTimeFormatter.ofPattern("HH.mm"))
    } catch (_: Exception) {
        iso.take(16)
    }

fun formatDateShort(iso: String): String =
    try {
        java.time.OffsetDateTime.parse(iso)
            .atZoneSameInstant(DEVICE_ZONE)
            .format(java.time.format.DateTimeFormatter.ofPattern("EEE, d MMM yyyy"))
    } catch (_: Exception) {
        iso.take(10)
    }

fun timezoneLabel(timeZone: String?): String {
    val zone = runCatching { java.time.ZoneId.of(timeZone?.trim().orEmpty()) }.getOrNull() ?: DEVICE_ZONE
    return zone.getDisplayName(java.time.format.TextStyle.SHORT, java.util.Locale.ENGLISH)
}

internal fun kotlinx.serialization.json.JsonPrimitive?.contentOrNull(): String? =
    this?.content?.takeIf { it != "null" }
