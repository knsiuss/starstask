package id.starstask.mobile.ui.screens

import id.starstask.mobile.data.CalendarTimelineItem
import id.starstask.mobile.data.addDaysToDateKey
import id.starstask.mobile.data.addDaysToDateKey

// Timeline helpers (web shared/calendar.ts): marked days + grouping.
// Extracted from ScheduleLeaveScreens.kt to keep that file focused.

/** Days touched by at least one item span (web buildMarkedDayKeys). */
fun buildMarkedDayKeys(items: List<CalendarTimelineItem>): Set<String> {
    val marked = mutableSetOf<String>()
    for (item in items) {
        var key = item.startKey
        val end = maxOf(item.startKey, item.endKey)
        while (key <= end) {
            marked.add(key)
            key = addDaysToDateKey(key, 1)
        }
    }
    return marked
}

/** Assignment bars list on their deadline day; events on start day. */
fun groupTimelineItems(
    items: List<CalendarTimelineItem>,
    fromKey: String,
    toKey: String,
): List<Pair<String, List<CalendarTimelineItem>>> {
    val map = linkedMapOf<String, MutableList<CalendarTimelineItem>>()
    for (item in items) {
        val key = if (item.kind == "assignment") item.endKey else item.startKey
        if (key < fromKey || key > toKey) continue
        map.getOrPut(key) { mutableListOf() }.add(item)
    }
    return map.entries.sortedBy { it.key }.map { (key, dayItems) ->
        key to dayItems.sortedWith(
            compareBy<CalendarTimelineItem> { if (it.kind == "assignment") 0 else 1 }.thenBy { it.title },
        )
    }
}
