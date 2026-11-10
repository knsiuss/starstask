package id.starstask.mobile.data

// Weekly timetable for the Schedule tab, mirroring web listClassSchedule
// (apps/web/src/lib/db/class-schedule.ts). Times come from Postgres `time`
// (`HH:mm:ss`) and day_of_week is 1=Monday..7=Sunday. RLS: members read.

import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

data class ClassScheduleSlot(
    val id: String,
    val subjectId: String?,
    val subjectName: String,
    val subjectCode: String?,
    val dayOfWeek: Int,
    val startTime: String,
    val endTime: String,
    val room: String?,
    val lecturerName: String?,
)

suspend fun loadClassSchedule(classId: String): List<ClassScheduleSlot> {
    val db = SupabaseProvider.client.postgrest
    val slots = db.from("class_course_schedules").select {
        filter { eq("class_id", classId) }
        order("day_of_week", Order.ASCENDING)
        order("start_time", Order.ASCENDING)
    }.decodeJsonArray()
    if (slots.isEmpty()) return emptyList()

    val subjectIds = slots.mapNotNull { it.jsonObject["subject_id"]?.jsonPrimitive?.contentOrNull() }.toSet()
    val subjects = if (subjectIds.isEmpty()) {
        emptyMap()
    } else {
        val subjectRows = db.from("class_subjects").select {
            filter { isIn("id", subjectIds.toList()) }
        }.decodeJsonArray()
        subjectRows.associateBy(
            { it.jsonObject["id"]?.jsonPrimitive?.content ?: "" },
            { it.jsonObject },
        )
    }

    return slots.mapNotNull { element ->
        val o = element.jsonObject
        val id = o["id"]?.jsonPrimitive?.contentOrNull() ?: return@mapNotNull null
        val subjectId = o["subject_id"]?.jsonPrimitive?.contentOrNull()
        val subject = subjectId?.let(subjects::get)
        ClassScheduleSlot(
            id = id,
            subjectId = subjectId,
            subjectName = subject?.get("name")?.jsonPrimitive?.contentOrNull() ?: "Course",
            subjectCode = subject?.get("code")?.jsonPrimitive?.contentOrNull(),
            dayOfWeek = o["day_of_week"]?.jsonPrimitive?.contentOrNull()?.toIntOrNull() ?: return@mapNotNull null,
            startTime = o["start_time"]?.jsonPrimitive?.contentOrNull()?.take(5) ?: "00:00",
            endTime = o["end_time"]?.jsonPrimitive?.contentOrNull()?.take(5) ?: "00:00",
            room = o["room"]?.jsonPrimitive?.contentOrNull(),
            lecturerName = o["lecturer_name"]?.jsonPrimitive?.contentOrNull()
                ?: subject?.get("lecturer_name")?.jsonPrimitive?.contentOrNull(),
        )
    }
}

fun weekdayLabel(dayOfWeek: Int): String = when (dayOfWeek) {
    1 -> "Monday"
    2 -> "Tuesday"
    3 -> "Wednesday"
    4 -> "Thursday"
    5 -> "Friday"
    6 -> "Saturday"
    7 -> "Sunday"
    else -> "Day $dayOfWeek"
}
