package id.starstask.mobile.data

/** Date/time formatting + JSON null helper shared by all data files. */

fun deviceDate(iso: String): String =
    try {
        java.time.OffsetDateTime.parse(iso)
            .atZoneSameInstant(DEVICE_ZONE)
            .toLocalDate().toString()
    } catch (_: Exception) {
        iso.take(10)
    }

fun formatTime(iso: String): String =
    try {
        java.time.OffsetDateTime.parse(iso)
            .atZoneSameInstant(DEVICE_ZONE)
            .toLocalTime()
            .format(
                java.time.format.DateTimeFormatter.ofLocalizedTime(java.time.format.FormatStyle.SHORT)
                    .withLocale(java.util.Locale.getDefault()),
            )
    } catch (_: Exception) {
        iso.take(16)
    }

fun formatDateShort(iso: String): String =
    try {
        java.time.OffsetDateTime.parse(iso)
            .atZoneSameInstant(DEVICE_ZONE)
            .format(
                java.time.format.DateTimeFormatter.ofLocalizedDate(java.time.format.FormatStyle.MEDIUM)
                    .withLocale(java.util.Locale.getDefault()),
            )
    } catch (_: Exception) {
        iso.take(10)
    }

fun timezoneLabel(timeZone: String?): String {
    val zone = runCatching { java.time.ZoneId.of(timeZone?.trim().orEmpty()) }.getOrNull() ?: DEVICE_ZONE
    return zone.getDisplayName(java.time.format.TextStyle.SHORT, java.util.Locale.getDefault())
}

// Package-internal shortcut for JsonPrimitive?.content that also maps the
// literal "null" string to null. Intentionally shadows the kotlinx extension
// for callers across this package that expect null instead of "null".
internal fun kotlinx.serialization.json.JsonPrimitive?.contentOrNull(): String? =
    this?.content?.takeIf { it != "null" }
