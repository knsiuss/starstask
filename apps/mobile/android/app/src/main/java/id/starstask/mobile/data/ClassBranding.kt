package id.starstask.mobile.data

import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

/**
 * Class export branding, mirroring web features/export-branding +
 * lib/db/export-branding.ts (table class_export_branding, manager-only
 * writes via RLS).
 */

data class ClassBranding(
    val universityName: String, val universityShortName: String?, val faculty: String?,
    val department: String?, val documentTitle: String, val productName: String,
    val brandingEnabled: Boolean, val passingThreshold: Double,
)

suspend fun loadClassBranding(classId: String): ClassBranding? {
    val row = SupabaseProvider.client.postgrest.from("class_export_branding")
        .select(Columns.list("university_name", "university_short_name", "faculty", "department", "document_title", "product_name", "branding_enabled", "passing_threshold")) {
            filter { eq("class_id", classId) }
            limit(1)
        }.decodeJsonArray().firstOrNull()?.jsonObject ?: return null
    return ClassBranding(
        universityName = row["university_name"]?.jsonPrimitive?.contentOrNull() ?: "",
        universityShortName = row["university_short_name"]?.jsonPrimitive?.contentOrNull(),
        faculty = row["faculty"]?.jsonPrimitive?.contentOrNull(),
        department = row["department"]?.jsonPrimitive?.contentOrNull(),
        documentTitle = row["document_title"]?.jsonPrimitive?.contentOrNull() ?: "",
        productName = row["product_name"]?.jsonPrimitive?.contentOrNull() ?: "StarsTask",
        brandingEnabled = row["branding_enabled"]?.jsonPrimitive?.content == "true",
        passingThreshold = row["passing_threshold"]?.jsonPrimitive?.contentOrNull()?.toDoubleOrNull() ?: 0.0,
    )
}

suspend fun saveClassBranding(classId: String, branding: ClassBranding): String? {
    if (branding.universityName.isBlank()) return "University name is required."
    if (branding.documentTitle.isBlank()) return "Document title is required."
    if (branding.passingThreshold < 0 || branding.passingThreshold > 100) return "Passing threshold must be 0-100."
    val err = runCatching {
        SupabaseProvider.client.postgrest.from("class_export_branding").upsert(
            buildJsonObject {
                put("class_id", JsonPrimitive(classId))
                put("university_name", JsonPrimitive(branding.universityName.trim()))
                branding.universityShortName?.takeIf { it.isNotBlank() }?.let { put("university_short_name", JsonPrimitive(it.trim())) } ?: put("university_short_name", JsonNull)
                branding.faculty?.takeIf { it.isNotBlank() }?.let { put("faculty", JsonPrimitive(it.trim())) } ?: put("faculty", JsonNull)
                branding.department?.takeIf { it.isNotBlank() }?.let { put("department", JsonPrimitive(it.trim())) } ?: put("department", JsonNull)
                put("document_title", JsonPrimitive(branding.documentTitle.trim()))
                put("product_name", JsonPrimitive(branding.productName.trim()))
                put("branding_enabled", JsonPrimitive(branding.brandingEnabled))
                put("passing_threshold", JsonPrimitive(branding.passingThreshold))
            },
        )
    }.exceptionOrNull()
    return err?.message
}
