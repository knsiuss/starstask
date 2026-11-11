package id.starstask.mobile.data

import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Calendar date logic, ported from packages/shared/src/calendar.ts. */
/** All rendering/computation follows the device's zone (system default). */
val DEVICE_ZONE: ZoneId = ZoneId.systemDefault()
val CALENDAR_TZ: String get() = DEVICE_ZONE.id
const val LIST_WINDOW_DAYS = 30
const val EVENT_LIMIT = 500

/** `dateKeyT00:00:00<offset>` or `dateKeyT23:59:59<offset>` in the device zone. */
fun dayBoundaryIso(dateKey: String, inclusiveEndOfDay: Boolean = false): String {
    val local = if (inclusiveEndOfDay) {
        LocalDate.parse(dateKey).atTime(23, 59, 59)
    } else {
        LocalDate.parse(dateKey).atStartOfDay()
    }
    return local.atZone(DEVICE_ZONE).toOffsetDateTime()
        .format(java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME)
}

enum class CalendarView { MONTH, WEEK, DAY, LIST }

data class CalendarDayCell(val dateKey: String, val dayOfMonth: Int, val inMonth: Boolean)

data class CalendarRange(
    val view: CalendarView,
    val anchorKey: String,
    val startKey: String,
    val endKey: String,
    val fromIso: String,
    val toIso: String,
    val days: List<CalendarDayCell>,
)

/** `YYYY-MM-DD` for an instant in the device zone. */
fun toDeviceDateKey(iso: String): String =
    toJakartaDateKey(iso)

@Deprecated("Use toDeviceDateKey; kept for call sites not yet migrated.")
fun toJakartaDateKey(iso: String): String =
    try {
        java.time.OffsetDateTime.parse(iso).atZoneSameInstant(DEVICE_ZONE).toLocalDate().toString()
    } catch (_: Exception) {
        iso.take(10)
    }

fun deviceTodayKey(): String = LocalDate.now(DEVICE_ZONE).toString()

fun jakartaTodayKey(): String = deviceTodayKey()

fun parseDateKey(value: String): LocalDate? =
    try {
        LocalDate.parse(value.trim())
    } catch (_: Exception) {
        null
    }

fun addDaysToDateKey(value: String, delta: Int): String =
    (parseDateKey(value) ?: LocalDate.now(DEVICE_ZONE)).plusDays(delta.toLong()).toString()

/** Monday of the week containing `value` (ISO weekday, Mon=1..Sun=7). */
fun startOfWeekDateKey(value: String): String {
    val date = parseDateKey(value) ?: return jakartaTodayKey()
    return date.minusDays((date.dayOfWeek.value - 1).toLong()).toString()
}

fun weekDayOfDateKey(value: String): Int = parseDateKey(value)?.dayOfWeek?.value ?: 1

/** Shifts the anchor one page: month / week (7d) / day / list window (30d). */
fun shiftCalendarAnchor(view: CalendarView, anchorKey: String, delta: Int): String {
    val date = parseDateKey(anchorKey) ?: LocalDate.now(DEVICE_ZONE)
    return when (view) {
        CalendarView.MONTH -> date.plusMonths(delta.toLong()).toString()
        CalendarView.WEEK -> date.plusDays(7L * delta).toString()
        CalendarView.DAY -> date.plusDays(delta.toLong()).toString()
        CalendarView.LIST -> date.plusDays(LIST_WINDOW_DAYS.toLong() * delta).toString()
    }
}

/** Visible cells + half-open query window; month grids always render 42 cells. */
fun buildCalendarRange(view: CalendarView, anchorKey: String): CalendarRange {
    val anchor = parseDateKey(anchorKey) ?: LocalDate.now(DEVICE_ZONE)
    val anchorText = anchor.toString()
    val (startKey, dayCount, anchorMonth) = when (view) {
        CalendarView.MONTH -> {
            val first = anchor.withDayOfMonth(1)
            Triple(first.minusDays((first.dayOfWeek.value - 1).toLong()).toString(), 42, anchor.monthValue)
        }
        CalendarView.WEEK -> Triple(startOfWeekDateKey(anchorText), 7, null)
        CalendarView.DAY -> Triple(anchorText, 1, null)
        CalendarView.LIST -> Triple(anchorText, LIST_WINDOW_DAYS, null)
    }
    val days = (0 until dayCount).map { index ->
        val key = addDaysToDateKey(startKey, index)
        val date = parseDateKey(key)!!
        CalendarDayCell(key, date.dayOfMonth, anchorMonth == null || date.monthValue == anchorMonth)
    }
    val endKey = addDaysToDateKey(startKey, dayCount - 1)
    val dayAfterEnd = addDaysToDateKey(endKey, 1)
    return CalendarRange(
        view = view,
        anchorKey = anchorText,
        startKey = startKey,
        endKey = endKey,
        fromIso = dayBoundaryIso(startKey),
        toIso = dayBoundaryIso(dayAfterEnd),
        days = days,
    )
}

private val ENGLISH = Locale.ENGLISH
private val DAY_LABEL = DateTimeFormatter.ofPattern("EEE, dd MMM yyyy", ENGLISH)
private val GROUP_LABEL = DateTimeFormatter.ofPattern("EEEE, dd MMMM yyyy", ENGLISH)
private val MONTH_LABEL = DateTimeFormatter.ofPattern("MMMM yyyy", ENGLISH)
private val SHORT_DAY = DateTimeFormatter.ofPattern("EEE dd", ENGLISH)
private val SHORT_DAY_MONTH = DateTimeFormatter.ofPattern("d MMM", ENGLISH)
private val TIME_LABEL = DateTimeFormatter.ofPattern("HH:mm", ENGLISH)

fun formatDayLabel(dateKey: String): String = parseDateKey(dateKey)?.format(DAY_LABEL) ?: dateKey

/** `Saturday, 07 November 2026`, for a timeline date group header. */
fun formatGroupLabel(dateKey: String): String = parseDateKey(dateKey)?.format(GROUP_LABEL) ?: dateKey

fun formatMonthLabel(dateKey: String): String = parseDateKey(dateKey)?.format(MONTH_LABEL) ?: "Invalid date"


/** `Fri 06`, for a week column header. */
fun formatShortDay(dateKey: String): String = parseDateKey(dateKey)?.format(SHORT_DAY) ?: dateKey

fun formatShortDayMonth(dateKey: String): String = parseDateKey(dateKey)?.format(SHORT_DAY_MONTH) ?: dateKey

/** `19:00` in the device zone. */
fun formatCalendarTime(iso: String): String =
    try {
        java.time.OffsetDateTime.parse(iso)
            .atZoneSameInstant(DEVICE_ZONE)
            .toLocalTime()
            .format(TIME_LABEL)
    } catch (_: Exception) {
        "Invalid time"
    }

fun deviceLocalToInstantIso(dateKey: String, time: LocalTime): String =
    jakartaLocalToInstantIso(dateKey, time)

@Deprecated("Use deviceLocalToInstantIso; kept for call sites not yet migrated.")
fun jakartaLocalToInstantIso(dateKey: String, time: LocalTime): String =
    LocalDateTime.of(parseDateKey(dateKey) ?: LocalDate.now(DEVICE_ZONE), time)
        .atZone(DEVICE_ZONE)
        .toInstant()
        .toString()

/** Wall-clock of a stored instant in the device zone, for prefilling the form. */
fun deviceLocalDateTime(iso: String): LocalDateTime =
    jakartaLocalDateTime(iso)

@Deprecated("Use deviceLocalDateTime; kept for call sites not yet migrated.")
fun jakartaLocalDateTime(iso: String): LocalDateTime =
    try {
        java.time.OffsetDateTime.parse(iso).atZoneSameInstant(DEVICE_ZONE).toLocalDateTime()
    } catch (_: Exception) {
        LocalDate.now(DEVICE_ZONE).atStartOfDay()
    }

/** `weekday` is ISO (1=Mon..7=Sun); times are device-zone wall clock. */
open class WeeklySlotEntry(
    open val dayOfWeek: Int,
    open val startTime: String,
    open val endTime: String,
)

data class WeeklyOccurrence<T>(val entry: T, val dateKey: String, val startsAt: String, val endsAt: String)

/** Expands recurring timetable slots into dated occurrences (shared/calendar.ts). */
fun <T : WeeklySlotEntry> expandWeeklyScheduleForDays(
    entries: List<T>,
    days: List<String>,
): List<WeeklyOccurrence<T>> {
    val occurrences = mutableListOf<WeeklyOccurrence<T>>()
    val timePattern = Regex("^([01]\\d|2[0-3]):[0-5]\\d")
    for (day in days) {
        val weekday = weekDayOfDateKey(day)
        for (entry in entries) {
            if (entry.dayOfWeek != weekday) continue
            val start = entry.startTime.take(5)
            val end = entry.endTime.take(5)
            if (!timePattern.matches(start) || !timePattern.matches(end)) continue
            occurrences += WeeklyOccurrence(entry, day, dayTimeIso(day, start), dayTimeIso(day, end))
        }
    }
    return occurrences
}

/** `dayT{HH:mm}:00<device-offset>` — the ISO marker used by weekly timetable occurrences. */
fun dayTimeIso(dateKey: String, timeHHmm: String): String {
    val time = try {
        LocalTime.parse(timeHHmm)
    } catch (_: Exception) {
        LocalTime.MIDNIGHT
    }
    return LocalDate.parse(dateKey).atTime(time)
        .atZone(DEVICE_ZONE).toOffsetDateTime()
        .format(java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME)
}

/** Date-only span overlap, inclusive keys (shared/calendar.ts). */
fun dateSpanOverlapsWindow(startDate: String, endDate: String?, startKey: String, endKey: String): Boolean {
    val spanEnd = endDate ?: startDate
    return startDate <= endKey && spanEnd >= startKey
}

// --- Validation mirror (packages/contracts/src/calendar.ts) ---

const val CALENDAR_TITLE_MIN = 2
const val CALENDAR_TITLE_MAX = 160
const val CALENDAR_DESCRIPTION_MAX = 2_000
const val CALENDAR_OFFICIAL_DESCRIPTION_MAX = 5_000
const val CALENDAR_LOCATION_MAX = 200
const val CALENDAR_PERSONAL_WINDOW_MS = 30L * 24 * 60 * 60 * 1_000
const val CALENDAR_OFFICIAL_WINDOW_MS = 7L * 24 * 60 * 60 * 1_000

val OFFICIAL_EVENT_TYPES = listOf("class_schedule", "exam", "academic_event")

val CALENDAR_EVENT_TYPE_LABELS = mapOf(
    "class_schedule" to "Class schedule",
    "assignment" to "Assignment deadline",
    "absence" to "Absence notification",
    "exam" to "Exam",
    "academic_event" to "Academic event",
    "personal" to "Personal event",
)

data class CalendarFieldErrors(
    val title: String? = null,
    val endsAt: String? = null,
    val description: String? = null,
    val location: String? = null,
    val subjectId: String? = null,
) {
    fun hasErrors(): Boolean =
        title != null || endsAt != null || description != null || location != null || subjectId != null
}

fun validateCalendarEvent(
    title: String,
    startsAtIso: String?,
    endsAtIso: String?,
    description: String?,
    location: String?,
    maxDurationMs: Long,
    descriptionMax: Int,
): CalendarFieldErrors {
    val trimmed = title.trim()
    val titleError = when {
        trimmed.length < CALENDAR_TITLE_MIN -> "Give the event a title"
        trimmed.length > CALENDAR_TITLE_MAX -> "Keep the title under $CALENDAR_TITLE_MAX characters"
        else -> null
    }
    var endsAtError: String? = null
    if (startsAtIso != null && endsAtIso != null) {
        val start = runCatching { java.time.Instant.parse(startsAtIso).toEpochMilli() }.getOrNull()
        val end = runCatching { java.time.Instant.parse(endsAtIso).toEpochMilli() }.getOrNull()
        if (start != null && end != null) {
            if (end <= start) endsAtError = "The end time must be after the start time"
            else if (end - start > maxDurationMs) endsAtError = "That event is too long"
        }
    }
    return CalendarFieldErrors(
        title = titleError,
        endsAt = endsAtError,
        description = description?.takeIf { it.isNotBlank() }?.takeIf { it.length > descriptionMax }?.let {
            "Keep the description under $descriptionMax characters"
        },
        location = location?.takeIf { it.isNotBlank() }?.takeIf { it.length > CALENDAR_LOCATION_MAX }?.let {
            "Keep the location under $CALENDAR_LOCATION_MAX characters"
        },
    )
}

// --- Timeline board layout (web lib/schedule/timeline.ts) ---

const val MAX_VISIBLE_LANES = 3
const val WEEK_DAY_COUNT = 7

data class PositionedItem<T>(
    val item: T,
    val lane: Int,
    val colStart: Int,
    val span: Int,
)

data class WeekRowLayout<T>(
    val items: List<PositionedItem<T>>,
    val laneCount: Int,
    val hidden: List<T>,
)

fun overlapsWeek(startKey: String, endKey: String, rowStartKey: String, rowEndKey: String): Boolean =
    startKey <= rowEndKey && endKey >= rowStartKey

/** Clips one span to a week row and places it in the first free lane. */
fun <T> layoutWeekRow(
    items: List<T>,
    startKeyOf: (T) -> String,
    endKeyOf: (T) -> String,
    titleOf: (T) -> String,
    rowStartKey: String,
    maxVisibleLanes: Int = MAX_VISIBLE_LANES,
): WeekRowLayout<T> {
    val rowEndKey = addDaysToDateKey(rowStartKey, WEEK_DAY_COUNT - 1)
    val relevant = items.filter { item ->
        val start = minOf(startKeyOf(item), endKeyOf(item))
        val end = maxOf(startKeyOf(item), endKeyOf(item))
        overlapsWeek(start, end, rowStartKey, rowEndKey)
    }.sortedWith(
        compareBy<T> { minOf(startKeyOf(it), endKeyOf(it)) }
            .thenComparator { a, b ->
                val spanA = diffDays(minOf(startKeyOf(a), endKeyOf(a)), maxOf(startKeyOf(a), endKeyOf(a)))
                val spanB = diffDays(minOf(startKeyOf(b), endKeyOf(b)), maxOf(startKeyOf(b), endKeyOf(b)))
                when {
                    spanA != spanB -> spanB.compareTo(spanA)
                    else -> titleOf(a).compareTo(titleOf(b))
                }
            },
    )
    val lanes = Array(maxVisibleLanes) { mutableListOf<PositionedItem<T>>() }
    val hidden = mutableListOf<T>()
    for (item in relevant) {
        val start = minOf(startKeyOf(item), endKeyOf(item))
        val end = maxOf(startKeyOf(item), endKeyOf(item))
        val clippedStart = if (start > rowStartKey) start else rowStartKey
        val colStart = maxOf(0, diffDays(rowStartKey, clippedStart))
        val lastCol = minOf(WEEK_DAY_COUNT - 1, colStart + diffDays(clippedStart, end))
        val span = lastCol - colStart + 1
        val lane = lanes.indexOfFirst { laneItems ->
            val itemEnd = colStart + span
            laneItems.none { placed ->
                val placedEnd = placed.colStart + placed.span
                colStart < placedEnd && placed.colStart < itemEnd
            }
        }
        if (lane == -1) {
            hidden += item
        } else {
            lanes[lane] += PositionedItem(item, lane, colStart, span)
        }
    }
    return WeekRowLayout(
        items = lanes.flatMap { it },
        laneCount = lanes.count { it.isNotEmpty() },
        hidden = hidden,
    )
}

fun splitIntoWeeks(days: List<CalendarDayCell>): List<List<CalendarDayCell>> = days.chunked(WEEK_DAY_COUNT)

fun diffDays(fromKey: String, toKey: String): Int {
    val from = parseDateKey(fromKey) ?: return 0
    val to = parseDateKey(toKey) ?: return 0
    return (to.toEpochDay() - from.toEpochDay()).toInt()
}

/**
 * Stable colour slot for a course key (web course-colors.ts).
 *
 * The 31x multiplier keeps nearby keys like "pweb-1" / "pweb-2" in different
 * slots; Int overflow wraps identically to the web `>>> 0`.
 */
fun courseColorIndex(courseKey: String): Int {
    var hash = 0
    for (ch in courseKey) {
        hash = hash * 31 + ch.code
    }
    return Math.floorMod(hash, 10)
}
