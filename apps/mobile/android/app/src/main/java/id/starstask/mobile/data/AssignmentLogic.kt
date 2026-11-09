package id.starstask.mobile.data

// Translation of course-assignment-filters.ts pure helpers.
// No behaviour is invented — same grouping and sorting rules as web.

fun filterCourseAssignmentsByQuery(
    assignments: List<ExploreAssignment>,
    query: String,
): List<ExploreAssignment> {
    val normalized = query.trim().lowercase()
    if (normalized.isEmpty()) return assignments.toList()
    return assignments.filter { assignment ->
        listOf(
            assignment.title,
            assignment.description,
            assignment.sourceLabel.orEmpty(),
        ).joinToString(" ").lowercase().contains(normalized)
    }
}

private fun deadlineTime(assignment: ExploreAssignment): Long =
    assignment.deadline?.let { parseTime(it) } ?: Long.MAX_VALUE

private fun deadlineTimeLatest(assignment: ExploreAssignment): Long =
    assignment.deadline?.let { parseTime(it) } ?: Long.MIN_VALUE

internal fun parseTime(iso: String): Long {
    if (iso.isBlank()) return 0
    return try {
        java.time.OffsetDateTime.parse(iso).toInstant().toEpochMilli()
    } catch (_: Exception) {
        try {
            java.time.Instant.parse(iso).toEpochMilli()
        } catch (_: Exception) {
            try {
                java.time.LocalDateTime.parse(iso)
                    .atZone(java.time.ZoneId.of("Asia/Jakarta"))
                    .toInstant()
                    .toEpochMilli()
            } catch (_: Exception) {
                0
            }
        }
    }
}

private fun jakartaDayNumber(epochMs: Long): Long {
    val zone = java.time.ZoneId.of("Asia/Jakarta")
    val date = java.time.Instant.ofEpochMilli(epochMs).atZone(zone).toLocalDate()
    return date.toEpochDay()
}

fun getJakartaDayDifference(deadlineIso: String, nowMs: Long): Long {
    val deadlineMs = parseTime(deadlineIso)
    if (deadlineMs == 0L) return Long.MAX_VALUE
    return jakartaDayNumber(deadlineMs) - jakartaDayNumber(nowMs)
}

fun sortCourseAssignments(
    assignments: List<ExploreAssignment>,
    sort: String,
): List<ExploreAssignment> =
    when (sort) {
        "due-latest" -> assignments.sortedWith(
            compareByDescending<ExploreAssignment> { deadlineTimeLatest(it) }
                .thenBy { it.title },
        )
        "recent" -> assignments.sortedWith(
            compareByDescending<ExploreAssignment> {
                parseTime(it.createdAt ?: it.publishedAt ?: "")
            }.thenBy { it.title },
        )
        "title" -> assignments.sortedBy { it.title }
        else -> assignments.sortedWith(
            compareBy<ExploreAssignment> { deadlineTime(it) }.thenBy { it.title },
        )
    }

data class GroupedCourseAssignments(
    val upcoming: List<ExploreAssignment>,
    val inProgress: List<ExploreAssignment>,
    val closed: List<ExploreAssignment>,
)

fun groupCourseAssignments(
    assignments: List<ExploreAssignment>,
    completedIds: Set<String>,
    nowMs: Long,
): GroupedCourseAssignments {
    val upcoming = assignments
        .filter { it.deadline != null && parseTime(it.deadline) >= nowMs }
        .sortedBy { parseTime(it.deadline ?: "") }
    val inProgress = assignments.filter {
        it.deadline == null && !completedIds.contains(it.id)
    }
    val closed = assignments
        .filter { it.deadline != null && parseTime(it.deadline) < nowMs }
        .sortedByDescending { parseTime(it.deadline ?: "") }
    return GroupedCourseAssignments(upcoming, inProgress, closed)
}

// --- workspace.ts translations (Task Schedule) ---

typealias DeadlineUrgency = String

fun deadlineUrgency(deadline: String?, nowMs: Long): DeadlineUrgency {
    if (deadline.isNullOrBlank()) return "none"
    return if (parseTime(deadline) >= nowMs) "upcoming" else "expired"
}

fun sortScheduleItems(
    items: List<ExploreAssignment>,
    sort: String,
): List<ExploreAssignment> =
    when (sort) {
        "oldest" -> items.sortedBy { parseTime(it.createdAt ?: "") }
        "deadline" -> items.sortedWith { a, b ->
            when {
                a.deadline != null && b.deadline != null ->
                    parseTime(a.deadline).compareTo(parseTime(b.deadline))
                a.deadline != null -> -1
                b.deadline != null -> 1
                else -> parseTime(a.createdAt ?: "").compareTo(parseTime(b.createdAt ?: ""))
            }
        }
        else -> items.sortedByDescending { parseTime(it.createdAt ?: "") }
    }

fun formatRemainingTime(deadline: String?, nowMs: Long): String? {
    if (deadline.isNullOrBlank()) return null
    val diffMs = parseTime(deadline) - nowMs
    val absMs = kotlin.math.abs(diffMs)
    val minutes = kotlin.math.round(absMs / 60_000.0).toLong()
    val hours = kotlin.math.round(absMs / 3_600_000.0).toLong()
    val days = kotlin.math.round(absMs / 86_400_000.0).toLong()
    val amount = when {
        minutes < 60 -> "$minutes min"
        hours < 36 -> "$hours hour${if (hours == 1L) "" else "s"}"
        else -> "$days day${if (days == 1L) "" else "s"}"
    }
    return if (diffMs >= 0) "in $amount" else "expired $amount ago"
}

fun matchesScheduleStatus(
    assignment: ExploreAssignment,
    status: String,
    nowMs: Long,
): Boolean =
    when (status) {
        "all" -> true
        "upcoming" -> deadlineUrgency(assignment.deadline, nowMs) == "upcoming"
        "overdue" -> deadlineUrgency(assignment.deadline, nowMs) == "expired"
        "no_deadline" -> assignment.deadline == null
        else -> status == "published"
    }
