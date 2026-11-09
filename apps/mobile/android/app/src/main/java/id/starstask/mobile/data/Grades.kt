package id.starstask.mobile.data

import io.github.jan.supabase.postgrest.postgrest
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

/**
 * Course component grades, mirroring web lib/db/course-grades.ts.
 * Reads via list_course_component_grades (class member OK); writes via
 * set_course_component_grade (class manager only, DB is authority).
 * Returns stable error string or null on success for UI surfacing.
 */

fun validateComponentGrade(score: Double?): String? {
    if (score == null || score.isNaN() || score.isInfinite()) return "Enter a score."
    if (score < 0 || score > 100) return "Score must be between 0 and 100."
    return null
}

suspend fun listCourseComponentGrades(classId: String, subjectId: String): Map<String, Double> {
    val result = SupabaseProvider.client.postgrest.rpc(
        "list_course_component_grades",
        buildJsonObject {
            put("p_class_id", JsonPrimitive(classId))
            put("p_subject_id", JsonPrimitive(subjectId))
        },
    )
    val obj = runCatching { result.decodeJsonObject() }.getOrNull() ?: return emptyMap()
    return obj.entries.mapNotNull { entry ->
        val k = entry.key
        val v = entry.value
        val n = runCatching { v.jsonPrimitive.content.toDoubleOrNull() }.getOrNull() ?: return@mapNotNull null
        k to n
    }.toMap()
}

suspend fun setCourseComponentGrade(
    classId: String,
    subjectId: String,
    studentId: String,
    component: String,
    score: Double,
): String? {
    validateComponentGrade(score)?.let { return it }
    val err = runCatching {
        SupabaseProvider.client.postgrest.rpc(
            "set_course_component_grade",
            buildJsonObject {
                put("p_class_id", JsonPrimitive(classId))
                put("p_subject_id", JsonPrimitive(subjectId))
                put("p_student_id", JsonPrimitive(studentId))
                put("p_component", JsonPrimitive(component))
                put("p_score", JsonPrimitive(score))
            },
        )
    }.exceptionOrNull()
    return if (err == null) null else (err.message ?: "Could not save the grade.")
}
