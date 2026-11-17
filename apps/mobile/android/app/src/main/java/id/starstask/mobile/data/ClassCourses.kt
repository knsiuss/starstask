package id.starstask.mobile.data

import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.filter.FilterOperator
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

// Translation of apps/web/src/lib/db/classes.ts listClassSubjects,
// countPublishedAssignmentsBySubject, countCourseContent, listCourseAssignments.

data class ClassCourse(
    val id: String,
    val classId: String?,
    val courseId: String?,
    val name: String,
    val code: String?,
    val description: String?,
    val lecturerName: String?,
    val status: String,
    val createdAt: String?,
)

data class CourseContentCounts(
    val assignments: Int,
    val announcements: Int,
    val materials: Int,
)

suspend fun listClassCourses(classId: String, includeArchived: Boolean): List<ClassCourse> {
    val db = SupabaseProvider.client.postgrest
    val rows = db.from("class_subjects").select {
        filter {
            eq("class_id", classId)
            if (!includeArchived) eq("status", "active")
        }
        order("created_at", io.github.jan.supabase.postgrest.query.Order.ASCENDING)
    }.decodeJsonArray()
    return rows.mapNotNull { row ->
        val obj = row.jsonObject
        ClassCourse(
            id = obj["id"]?.jsonPrimitive?.content ?: return@mapNotNull null,
            classId = obj["class_id"]?.jsonPrimitive?.contentOrNull(),
            courseId = obj["course_id"]?.jsonPrimitive?.contentOrNull(),
            name = obj["name"]?.jsonPrimitive?.contentOrNull() ?: "Course",
            code = obj["code"]?.jsonPrimitive?.contentOrNull(),
            description = obj["description"]?.jsonPrimitive?.contentOrNull(),
            lecturerName = obj["lecturer_name"]?.jsonPrimitive?.contentOrNull(),
            status = obj["status"]?.jsonPrimitive?.contentOrNull() ?: "active",
            createdAt = obj["created_at"]?.jsonPrimitive?.contentOrNull(),
        )
    }
}

suspend fun countPublishedAssignmentsBySubject(classId: String): Map<String, Int> {
    val db = SupabaseProvider.client.postgrest
    val subjects = db.from("class_subjects").select {
        filter { eq("class_id", classId) }
    }.decodeJsonArray()
    val subjectIds = subjects.mapNotNull { it.jsonObject["id"]?.jsonPrimitive?.content }
    val courseIds = subjects.mapNotNull { it.jsonObject["course_id"]?.jsonPrimitive?.contentOrNull() }.distinct()
    val counts = mutableMapOf<String, Int>()

    val scoped = db.from("assignments").select {
        filter {
            eq("class_id", classId)
            eq("status", "published")
            isIn("subject_id", subjectIds)
        }
    }.decodeJsonArray()
    scoped.forEach { row ->
        val subjectId = row.jsonObject["subject_id"]?.jsonPrimitive?.contentOrNull() ?: return@forEach
        counts[subjectId] = (counts[subjectId] ?: 0) + 1
    }

    if (courseIds.isNotEmpty()) {
        val publicRows = db.from("assignments").select {
            filter {
                filter("class_id", FilterOperator.IS, null)
                filter("subject_id", FilterOperator.IS, null)
                eq("status", "published")
                isIn("course_id", courseIds)
            }
        }.decodeJsonArray()
        val publicCounts = mutableMapOf<String, Int>()
        publicRows.forEach { row ->
            val courseId = row.jsonObject["course_id"]?.jsonPrimitive?.contentOrNull() ?: return@forEach
            publicCounts[courseId] = (publicCounts[courseId] ?: 0) + 1
        }
        // Distribute public counts across subjects of the same catalog course,
        // matching web bucket-by-course merge.
        subjects.forEach { subject ->
            val courseId = subject.jsonObject["course_id"]?.jsonPrimitive?.contentOrNull() ?: return@forEach
            val subjectId = subject.jsonObject["id"]?.jsonPrimitive?.content ?: return@forEach
            val publicCount = publicCounts[courseId] ?: 0
            if (publicCount > 0) {
                counts[subjectId] = (counts[subjectId] ?: 0) + publicCount
            }
        }
    }
    return counts
}

suspend fun countCourseContent(classId: String, subjectId: String): CourseContentCounts {
    val db = SupabaseProvider.client.postgrest
    val subjectRow = db.from("class_subjects").select {
        filter { eq("id", subjectId) }
        limit(1)
    }.decodeJsonArray().firstOrNull()?.jsonObject
    val courseId = subjectRow?.get("course_id")?.jsonPrimitive?.contentOrNull()

    val assignmentRows = db.from("assignments").select {
        filter {
            eq("status", "published")
            if (courseId != null) {
                or {
                    and {
                        eq("class_id", classId)
                        eq("subject_id", subjectId)
                    }
                    and {
                        filter("class_id", FilterOperator.IS, null)
                        filter("subject_id", FilterOperator.IS, null)
                        eq("course_id", courseId)
                    }
                }
            } else {
                eq("class_id", classId)
                eq("subject_id", subjectId)
            }
        }
    }.decodeJsonArray()

    var assignmentsCount = 0
    var announcementsCount = 0
    assignmentRows.forEach { row ->
        if (row.jsonObject["content_type"]?.jsonPrimitive?.contentOrNull() == "class_announcement") {
            announcementsCount += 1
        } else {
            assignmentsCount += 1
        }
    }

    val materials = db.from("course_materials").select {
        filter {
            eq("class_id", classId)
            eq("subject_id", subjectId)
        }
    }.decodeJsonArray()

    return CourseContentCounts(assignmentsCount, announcementsCount, materials.size)
}

data class CourseMaterial(
    val id: String,
    val kind: String,
    val title: String,
    val description: String?,
    val resourceUrl: String?,
    val createdAt: String?,
)

suspend fun listCourseMaterials(classId: String, subjectId: String): List<CourseMaterial> {
    val rows = SupabaseProvider.client.postgrest.from("course_materials").select {
        filter {
            eq("class_id", classId)
            eq("subject_id", subjectId)
        }
        order("created_at", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
        limit(100)
    }.decodeJsonArray()
    return rows.mapNotNull { row ->
        val obj = row.jsonObject
        CourseMaterial(
            id = obj["id"]?.jsonPrimitive?.content ?: return@mapNotNull null,
            kind = obj["kind"]?.jsonPrimitive?.contentOrNull() ?: "link",
            title = obj["title"]?.jsonPrimitive?.contentOrNull() ?: "Material",
            description = obj["description"]?.jsonPrimitive?.contentOrNull(),
            resourceUrl = obj["resource_url"]?.jsonPrimitive?.contentOrNull(),
            createdAt = obj["created_at"]?.jsonPrimitive?.contentOrNull(),
        )
    }
}

suspend fun updateClassCourse(
    subjectId: String,
    name: String,
    code: String?,
    lecturerName: String?,
) {
    val patch = buildJsonObject {
        put("name", JsonPrimitive(name.trim()))
        if (code.isNullOrBlank()) put("code", JsonNull) else put("code", JsonPrimitive(code.trim()))
        if (lecturerName.isNullOrBlank()) put("lecturer_name", JsonNull) else put("lecturer_name", JsonPrimitive(lecturerName.trim()))
    }
    SupabaseProvider.client.postgrest.from("class_subjects").update(patch) {
        filter { eq("id", subjectId) }
    }
}

suspend fun createCourseMaterial(
    classId: String,
    subjectId: String,
    title: String,
    resourceUrl: String?,
) {
    SupabaseProvider.client.postgrest.from("course_materials").insert(
        buildJsonObject {
            put("class_id", JsonPrimitive(classId))
            put("subject_id", JsonPrimitive(subjectId))
            put("title", JsonPrimitive(title.trim()))
            put("kind", JsonPrimitive("link"))
            if (resourceUrl.isNullOrBlank()) put("resource_url", JsonNull) else put("resource_url", JsonPrimitive(resourceUrl.trim()))
        },
    )
}

suspend fun createClassCourse(
    classId: String,
    name: String,
    code: String?,
    lecturerName: String?,
    description: String?,
): ClassCourse {
    val result = SupabaseProvider.client.postgrest.from("class_subjects").insert(
        buildJsonObject {
            put("class_id", JsonPrimitive(classId))
            put("name", JsonPrimitive(name.trim()))
            if (code?.isNotBlank() == true) put("code", JsonPrimitive(code.trim()))
            if (lecturerName?.isNotBlank() == true) put("lecturer_name", JsonPrimitive(lecturerName.trim()))
            if (description?.isNotBlank() == true) put("description", JsonPrimitive(description.trim()))
        },
    ) {
        select()
    }.decodeJsonArray().firstOrNull()?.jsonObject

    return ClassCourse(
        id = result?.get("id")?.jsonPrimitive?.content ?: throw IllegalStateException("Could not create subject"),
        classId = result?.get("class_id")?.jsonPrimitive?.contentOrNull(),
        courseId = result?.get("course_id")?.jsonPrimitive?.contentOrNull(),
        name = result?.get("name")?.jsonPrimitive?.contentOrNull() ?: name,
        code = result?.get("code")?.jsonPrimitive?.contentOrNull(),
        description = result?.get("description")?.jsonPrimitive?.contentOrNull(),
        lecturerName = result?.get("lecturer_name")?.jsonPrimitive?.contentOrNull(),
        status = result?.get("status")?.jsonPrimitive?.contentOrNull() ?: "active",
        createdAt = result?.get("created_at")?.jsonPrimitive?.contentOrNull(),
    )
}
