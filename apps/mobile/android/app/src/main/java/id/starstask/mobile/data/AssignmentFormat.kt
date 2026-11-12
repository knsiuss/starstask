package id.starstask.mobile.data

// Translation of @starstask/shared format.ts + deadline.ts (device timezone).

fun excerpt(text: String, maxLength: Int = 180): String {
    val normalized = text.replace(Regex("\\s+"), " ").trim()
    if (normalized.length <= maxLength) return normalized
    val sliced = normalized.substring(0, maxLength)
    val lastSpace = sliced.lastIndexOf(" ")
    val cut = if (lastSpace > maxLength * 0.6) sliced.substring(0, lastSpace) else sliced
    return "${cut.trimEnd()}..."
}

fun pluralize(count: Long, singular: String): String =
    if (count == 1L) singular else "${singular}s"

enum class DeadlineState { NONE, UPCOMING, DUE_TODAY, OVERDUE }

fun getDeadlineState(
    deadline: String?,
    now: java.time.Instant = java.time.Instant.now(),
): DeadlineState {
    if (deadline.isNullOrBlank()) return DeadlineState.NONE
    val instant = try {
        java.time.OffsetDateTime.parse(deadline).toInstant()
    } catch (_: Exception) {
        try {
            java.time.Instant.parse(deadline)
        } catch (_: Exception) {
            try {
                java.time.LocalDateTime.parse(deadline)
                    .atZone(java.time.ZoneId.systemDefault())
                    .toInstant()
            } catch (_: Exception) {
                return DeadlineState.NONE
            }
        }
    }
    if (!instant.isAfter(now)) return DeadlineState.OVERDUE
    val zone = java.time.ZoneId.systemDefault()
    return if (instant.atZone(zone).toLocalDate() == now.atZone(zone).toLocalDate()) {
        DeadlineState.DUE_TODAY
    } else {
        DeadlineState.UPCOMING
    }
}

fun deadlineStateLabel(state: DeadlineState): String =
    when (state) {
        DeadlineState.NONE -> "No deadline"
        DeadlineState.UPCOMING -> "Upcoming"
        DeadlineState.DUE_TODAY -> "Due today"
        DeadlineState.OVERDUE -> "Passed"
    }

private val DEADLINE_FMT = java.time.format.DateTimeFormatter.ofPattern("dd MMM yyyy, HH:mm", java.util.Locale.getDefault())
private val DATE_FMT = java.time.format.DateTimeFormatter.ofPattern("dd MMM yyyy", java.util.Locale.getDefault())

fun formatDeadline(deadline: String): String =
    try {
        val zoned = java.time.OffsetDateTime.parse(deadline)
            .atZoneSameInstant(java.time.ZoneId.systemDefault())
        "${zoned.format(DEADLINE_FMT)} ${zoned.zone.id}"
    } catch (_: Exception) {
        try {
            val local = java.time.LocalDateTime.parse(deadline)
                .atZone(java.time.ZoneId.systemDefault())
            "${local.format(DEADLINE_FMT)} ${local.zone.id}"
        } catch (_: Exception) {
            deadline.take(16)
        }
    }

fun formatCreatedDate(iso: String?): String {
    if (iso.isNullOrBlank()) return ""
    return try {
        java.time.OffsetDateTime.parse(iso)
            .atZoneSameInstant(java.time.ZoneId.systemDefault())
            .format(DATE_FMT)
    } catch (_: Exception) {
        iso.take(10)
    }
}
