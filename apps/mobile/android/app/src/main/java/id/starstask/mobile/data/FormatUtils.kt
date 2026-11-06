package id.starstask.mobile.data

/** Date/time formatting + JSON null helper shared by all data files. */

fun jakartaDate(iso: String): String =
    try {
        java.time.OffsetDateTime.parse(iso)
            .atZoneSameInstant(java.time.ZoneId.of("Asia/Jakarta"))
            .toLocalDate().toString()
    } catch (_: Exception) {
        iso.substring(0, 10)
    }

fun formatTime(iso: String): String =
    try {
        java.time.OffsetDateTime.parse(iso)
            .atZoneSameInstant(java.time.ZoneId.of("Asia/Jakarta"))
            .toLocalTime().format(java.time.format.DateTimeFormatter.ofPattern("HH.mm"))
    } catch (_: Exception) {
        iso.take(16)
    }

fun formatDateShort(iso: String): String =
    try {
        java.time.OffsetDateTime.parse(iso)
            .atZoneSameInstant(java.time.ZoneId.of("Asia/Jakarta"))
            .format(java.time.format.DateTimeFormatter.ofPattern("EEE, d MMM yyyy"))
    } catch (_: Exception) {
        iso.take(10)
    }

internal fun kotlinx.serialization.json.JsonPrimitive?.contentOrNull(): String? =
    this?.content?.takeIf { it != "null" }
