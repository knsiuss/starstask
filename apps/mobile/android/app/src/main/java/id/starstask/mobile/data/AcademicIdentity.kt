package id.starstask.mobile.data

import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.filter.FilterOperator
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.Serializable


// ---------------------------------------------------------------------------
// Academic identity card (web AcademicContextCard): university + student id
// + home class, with the "not linked" state. Semester/year stays on each
// class row in My classes.
// ---------------------------------------------------------------------------

@Serializable
data class AcademicCard(
    val linked: Boolean,
    val universityName: String? = null,
    val studentId: String? = null,
    val homeClassName: String? = null,
)

suspend fun loadAcademicCard(userId: String): AcademicCard? {
    val db = SupabaseProvider.client.postgrest
    val memberships = try {
        db.from("university_memberships").select {
            order("created_at", io.github.jan.supabase.postgrest.query.Order.ASCENDING)
        }.decodeJsonArray()
    } catch (_: Exception) {
        return null
    }

    val active = memberships.filter {
        it.jsonObject["status"]?.jsonPrimitive?.contentOrNull() == "active"
    }
    // Web resolves identity only when exactly one active membership exists.
    if (active.size != 1) return AcademicCard(linked = false)

    val onlyActive = active.single()
    val universityId = onlyActive.jsonObject["university_id"]?.jsonPrimitive?.contentOrNull()
        ?: return AcademicCard(linked = false)

    val university = try {
        db.from("universities").select {
            filter { eq("id", universityId) }
            limit(1)
        }.decodeJsonArray().firstOrNull()?.jsonObject
    } catch (_: Exception) {
        null
    }
    if (university == null || university["status"]?.jsonPrimitive?.contentOrNull() != "active") {
        return AcademicCard(linked = false)
    }
    val universityName = university["short_name"]?.jsonPrimitive?.contentOrNull()
        ?: university["name"]?.jsonPrimitive?.contentOrNull()
        ?: return AcademicCard(linked = false)

    val identities = try {
        db.from("student_identities").select {
            filter { eq("university_membership_id", onlyActive.jsonObject["id"]!!.jsonPrimitive.content) }
        }.decodeJsonArray()
    } catch (_: Exception) {
        emptyList()
    }
    val studentId = identities.firstOrNull()?.jsonObject?.get("student_id")?.jsonPrimitive?.contentOrNull()

    val homeClassName = run {
        val identityIds = identities.mapNotNull { it.jsonObject["id"]?.jsonPrimitive?.content }
        if (identityIds.isEmpty()) {
            null
        } else {
            try {
                val home = db.from("class_memberships").select(Columns.raw("class_id")) {
                    filter {
                        isIn("student_identity_id", identityIds)
                        eq("is_home", true)
                        filter("left_at", FilterOperator.IS, null)
                    }
                    limit(1)
                }.decodeJsonArray().firstOrNull()
                val homeClassId = home?.jsonObject?.get("class_id")?.jsonPrimitive?.contentOrNull()
                if (homeClassId == null) {
                    null
                } else {
                    db.from("classes").select(Columns.raw("name")) {
                        filter { eq("id", homeClassId) }
                        limit(1)
                    }.decodeJsonArray().firstOrNull()?.jsonObject?.get("name")?.jsonPrimitive?.contentOrNull()
                }
            } catch (_: Exception) {
                null
            }
        }
    }

    return AcademicCard(
        linked = true,
        universityName = universityName,
        studentId = studentId,
        homeClassName = homeClassName,
    )
}

