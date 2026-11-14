package id.starstask.mobile.data

import android.content.Context
import android.net.Uri
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.storage.storage
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive

/**
 * Native profile data layer, mirroring the web profile implementation.
 *
 * Source of truth (web):
 * - Read: `get_my_profile` RPC (SECURITY DEFINER, owner-only, includes the
 *   private full name and NIM that have no client grant).
 * - Save: PATCH /api/profile -> `update_my_profile` + `update_my_bio`.
 *   NIM/university are re-sent from the stored profile, never accepted from
 *   the client, because `update_my_profile` writes the whole row.
 * - Avatar: PNG/JPG only, magic-byte checked, 2 MB max, stored at
 *   `{user_id}/{uuid}.{ext}` in the `avatars` bucket, then
 *   `set_my_avatar_url` points the profile at the public URL.
 * - Class admin claim: `become_class_representative(p_class_id)` re-checks
 *   membership, class status, and the 5-per-class cap server-side.
 * - Cover image: NOT supported by the web app (no column, no UI), so the
 *   native screen renders a default visual and offers no cover edit.
 */

const val PROFILE_FULL_NAME_MAX = 80
const val PROFILE_NICKNAME_MAX = 60
const val PROFILE_BIO_MAX = 280
const val PROFILE_AVATAR_MAX_BYTES = 2 * 1024 * 1024

val PROFILE_AVATAR_ALLOWED_EXTENSIONS = setOf("png", "jpg", "jpeg")

data class MyProfile(
    val id: String,
    val fullName: String?,
    val nickname: String,
    val nim: String?,
    val university: String?,
    val declaredClassName: String?,
    val avatarUrl: String?,
    val bio: String?,
    val onboardedAt: String?,
)

data class ProfileClass(
    val id: String,
    val slug: String,
    val name: String,
    val semester: String,
    val academicYear: String,
    val status: String,
    val isAdmin: Boolean = false,
)

data class ProfileClasses(
    val classes: List<ProfileClass>,
    /** Active classes the user does not administer yet (claimable). */
    val claimable: List<ProfileClass>,
    /** Classes the user administers (representative access). */
    val administered: List<ProfileClass>,
)

class ProfileSaveOutcome(
    val profile: MyProfile? = null,
    val fieldErrors: Map<String, String> = emptyMap(),
    val message: String? = null,
    val succeeded: Boolean = false,
)

suspend fun loadMyProfile(): MyProfile? {
    val db = SupabaseProvider.client.postgrest
    val data = db.rpc("get_my_profile", kotlinx.serialization.json.buildJsonObject {})
    val obj = try {
        data.decodeJsonArray().firstOrNull()?.jsonObject
    } catch (_: Exception) {
        try { data.decodeAs<kotlinx.serialization.json.JsonObject>() } catch (_: Exception) { null }
    } ?: return null
    return obj.toMyProfile()
}

private fun JsonElement.toMyProfile(): MyProfile? {
    val obj = try { this.jsonObject } catch (_: Exception) { return null }
    val id = obj["id"]?.jsonPrimitive?.contentOrNull() ?: return null
    return MyProfile(
        id = id,
        fullName = obj["fullName"]?.jsonPrimitive?.contentOrNull(),
        nickname = obj["nickname"]?.jsonPrimitive?.contentOrNull() ?: "",
        nim = obj["nim"]?.jsonPrimitive?.contentOrNull(),
        university = obj["university"]?.jsonPrimitive?.contentOrNull(),
        declaredClassName = obj["declaredClassName"]?.jsonPrimitive?.contentOrNull(),
        avatarUrl = obj["avatarUrl"]?.jsonPrimitive?.contentOrNull(),
        bio = obj["bio"]?.jsonPrimitive?.contentOrNull(),
        onboardedAt = obj["onboardedAt"]?.jsonPrimitive?.contentOrNull(),
    )
}

/**
 * Field validation mirroring web `profileSettingsSchema` (contracts/profile.ts):
 * full name 2-80, nickname 2-60, bio up to 280. Pure so it is unit-testable;
 * [saveProfileSettings] calls this with the trimmed values.
 */
fun validateProfileSettings(fullName: String, nickname: String, bio: String): Map<String, String> {
    val errors = mutableMapOf<String, String>()
    if (fullName.length < 2) errors["fullName"] = "Full name must be at least 2 characters"
    if (fullName.length > PROFILE_FULL_NAME_MAX) {
        errors["fullName"] = "Full name must be ${PROFILE_FULL_NAME_MAX} characters or fewer"
    }
    if (nickname.length < 2) errors["nickname"] = "Nickname must be at least 2 characters"
    if (nickname.length > PROFILE_NICKNAME_MAX) {
        errors["nickname"] = "Nickname must be ${PROFILE_NICKNAME_MAX} characters or fewer"
    }
    if (bio.length > PROFILE_BIO_MAX) {
        errors["bio"] = "Bio must be ${PROFILE_BIO_MAX} characters or fewer"
    }
    return errors
}

/**
 * Saves full name, nickname, and bio with the same rules as
 * `profileSettingsSchema` + PATCH /api/profile. NIM and university are
 * re-sent from [current] (the stored profile) — never taken from the form.
 */
suspend fun saveProfileSettings(
    current: MyProfile,
    fullName: String,
    nickname: String,
    bio: String,
): ProfileSaveOutcome {
    val name = fullName.trim()
    val nick = nickname.trim()
    val bioValue = bio.trim()
    val errors = validateProfileSettings(name, nick, bioValue)
    if (errors.isNotEmpty()) return ProfileSaveOutcome(fieldErrors = errors)

    val nim = current.nim?.trim().orEmpty()
    val university = current.university?.trim().orEmpty()
    if (nim.isEmpty() || university.isEmpty()) {
        return ProfileSaveOutcome(message = "Finish setting up your profile before editing it.")
    }

    val db = SupabaseProvider.client.postgrest
    return try {
        db.rpc(
            "update_my_profile",
            kotlinx.serialization.json.buildJsonObject {
                put("p_full_name", name)
                put("p_nickname", nick)
                put("p_nim", nim)
                put("p_university", university)
                put("p_declared_class", current.declaredClassName)
            },
        )
        db.rpc(
            "update_my_bio",
            kotlinx.serialization.json.buildJsonObject { put("p_bio", bioValue) },
        )
        val refreshed = loadMyProfile() ?: current.copy(
            fullName = name,
            nickname = nick,
            bio = bioValue.ifEmpty { null },
        )
        ProfileSaveOutcome(profile = refreshed, succeeded = true)
    } catch (e: Exception) {
        ProfileSaveOutcome(message = friendlyProfileError(e))
    }
}

suspend fun loadProfileClasses(userId: String): ProfileClasses {
    val db = SupabaseProvider.client.postgrest
    val memberships = db.from("class_members").select {
        filter { eq("user_id", userId) }
        order("joined_at", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
        limit(100)
    }.decodeJsonArray()
    val classIds = memberships.mapNotNull {
        it.jsonObject["class_id"]?.jsonPrimitive?.contentOrNull()
    }
    if (classIds.isEmpty()) return ProfileClasses(emptyList(), emptyList(), emptyList())

    val classRows = db.from("classes").select {
        filter { isIn("id", classIds) }
    }.decodeJsonArray()
    val adminIds = try {
        db.from("class_admins").select {
            filter { eq("user_id", userId); isIn("class_id", classIds) }
        }.decodeJsonArray().mapNotNull {
            it.jsonObject["class_id"]?.jsonPrimitive?.contentOrNull()
        }.toSet()
    } catch (_: Exception) {
        emptySet()
    }
    val classes = classRows.mapNotNull { row ->
        val obj = row.jsonObject
        val id = obj["id"]?.jsonPrimitive?.contentOrNull() ?: return@mapNotNull null
        ProfileClass(
            id = id,
            slug = obj["slug"]?.jsonPrimitive?.contentOrNull() ?: id,
            name = obj["name"]?.jsonPrimitive?.contentOrNull() ?: id,
            semester = obj["semester"]?.jsonPrimitive?.contentOrNull() ?: "",
            academicYear = obj["academic_year"]?.jsonPrimitive?.contentOrNull() ?: "",
            status = obj["status"]?.jsonPrimitive?.contentOrNull() ?: "",
            isAdmin = id in adminIds,
        )
    }
    val administered = classes.filter { it.isAdmin }
    val claimable = classes.filter { it.status == "active" && !it.isAdmin }
    return ProfileClasses(classes, claimable, administered)
}

class ClaimOutcome(val message: String, val succeeded: Boolean)

/** Platform-admin predicate, mirroring web `isPlatformAdmin()` (`is_platform_admin` RPC). */
suspend fun checkPlatformAdmin(): Boolean {
    val db = SupabaseProvider.client.postgrest
    return try {
        db.rpc("is_platform_admin", kotlinx.serialization.json.buildJsonObject {})
            .decodeJsonPrimitive().contentOrNull() == "true"
    } catch (_: Exception) {
        false
    }
}

/**
 * Bio-only save (web ProfileBioForm → PATCH /api/profile/bio). Does not
 * touch name/nickname, so it also works for platform admins whose profile
 * may be missing NIM/university.
 */
suspend fun saveBioOnly(bio: String): MyProfile? {
    val db = SupabaseProvider.client.postgrest
    return try {
        db.rpc(
            "update_my_bio",
            kotlinx.serialization.json.buildJsonObject { put("p_bio", bio.trim()) },
        )
        loadMyProfile()
    } catch (_: Exception) {
        null
    }
}

/**
 * Claims representative access for one class. The RPC returns a text code
 * (granted / already_representative / limit_reached / not_member /
 * class_inactive) — same mapping as web `becomeClassRepresentative`.
 */
/**
 * Maps the RPC text code to a user-facing outcome, mirroring web
 * `becomeClassRepresentative` (verification-service.ts). Pure for testing:
 * `limit_reached`, `not_member`, and `class_inactive` must never read as
 * success.
 */
fun mapClaimCode(code: String?): ClaimOutcome {
    return when (code) {
        "granted" -> ClaimOutcome("You now have class representative access for this class.", true)
        "already_representative" -> ClaimOutcome("You are already the representative of this class.", true)
        "limit_reached" -> ClaimOutcome("This class already has 5 class representatives.", false)
        "not_member" -> ClaimOutcome("Join the class before becoming its representative.", false)
        "class_inactive" -> ClaimOutcome("This class is no longer active.", false)
        else -> ClaimOutcome("Could not make you a class representative.", false)
    }
}

suspend fun claimClassRepresentative(classId: String): ClaimOutcome {
    val db = SupabaseProvider.client.postgrest
    return try {
        val code = db.rpc(
            "become_class_representative",
            kotlinx.serialization.json.buildJsonObject { put("p_class_id", classId) },
        ).decodeJsonPrimitive().contentOrNull()
        mapClaimCode(code)
    } catch (_: Exception) {
        ClaimOutcome("Could not make you a class representative.", false)
    }
}

data class AvatarUploadOutcome(
    val avatarUrl: String? = null,
    val message: String? = null,
)

/**
 * Validates and stores a new profile photo, mirroring web `storeAvatar`:
 * extension + magic bytes (declared MIME is ignored), 2 MB max, then the
 * profile is pointed at the public URL. The object is removed again if the
 * pointer update fails, so a failed save leaves no orphan avatar.
 */
suspend fun uploadProfileAvatar(
    context: Context,
    userId: String,
    uri: Uri,
): AvatarUploadOutcome {
    val resolver = context.contentResolver
    val name = queryDisplayName(resolver, uri)
        ?: return AvatarUploadOutcome(message = "Could not read the file name.")
    val extension = name.substringAfterLast(".", "").lowercase()
    if (extension !in PROFILE_AVATAR_ALLOWED_EXTENSIONS) {
        return AvatarUploadOutcome(message = "Use a PNG or JPG image.")
    }
    val bytes = try {
        resolver.openInputStream(uri)?.readBytes()
    } catch (_: Exception) {
        null
    } ?: return AvatarUploadOutcome(message = "Could not read the file.")
    if (bytes.isEmpty()) return AvatarUploadOutcome(message = "The image is empty.")
    if (bytes.size > PROFILE_AVATAR_MAX_BYTES) {
        return AvatarUploadOutcome(message = "The photo must be 2 MB or smaller.")
    }
    val expectedMime = if (extension == "png") "image/png" else "image/jpeg"
    if (!hasValidImageSignature(bytes, expectedMime)) {
        return AvatarUploadOutcome(message = "$name is not a valid image.")
    }

    val objectName = "${java.util.UUID.randomUUID()}.$extension"
    val storagePath = "$userId/$objectName"
    val storage = SupabaseProvider.client.storage
    try {
        storage.from("avatars").upload(path = storagePath, data = bytes) { upsert = false }
    } catch (_: Exception) {
        return AvatarUploadOutcome(message = "Could not store the photo. Try again.")
    }
    val publicUrl = try {
        storage.from("avatars").publicUrl(storagePath)
    } catch (_: Exception) {
        runCatching { storage.from("avatars").delete(listOf(storagePath)) }
        return AvatarUploadOutcome(message = "Could not store the photo. Try again.")
    }
    return try {
        SupabaseProvider.client.postgrest.rpc(
            "set_my_avatar_url",
            kotlinx.serialization.json.buildJsonObject { put("p_avatar_url", publicUrl) },
        )
        AvatarUploadOutcome(avatarUrl = publicUrl)
    } catch (e: Exception) {
        runCatching { storage.from("avatars").delete(listOf(storagePath)) }
        AvatarUploadOutcome(message = friendlyProfileError(e))
    }
}

private fun hasValidImageSignature(bytes: ByteArray, mime: String): Boolean {
    return if (mime == "image/png") {
        bytes.size >= 8 &&
            bytes[0] == 0x89.toByte() && bytes[1] == 0x50.toByte() &&
            bytes[2] == 0x4E.toByte() && bytes[3] == 0x47.toByte()
    } else {
        bytes.size >= 3 &&
            bytes[0] == 0xFF.toByte() && bytes[1] == 0xD8.toByte() &&
            bytes[2] == 0xFF.toByte()
    }
}

private fun queryDisplayName(
    resolver: android.content.ContentResolver,
    uri: Uri,
): String? {
    return resolver.query(uri, arrayOf(android.provider.OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
        if (cursor.moveToFirst()) cursor.getString(0) else null
    }
}

private fun friendlyProfileError(error: Exception): String {
    val message = error.message.orEmpty()
    return when {
        "onboarding" in message || "not found" in message -> "Finish setting up your profile before editing it."
        "invalid" in message -> "Those details could not be saved. Check the fields and try again."
        "network" in message.lowercase() || "failed to connect" in message.lowercase() ->
            "Network error. Check your connection and try again."
        else -> "Could not save your profile. Try again."
    }
}

// --- Onboarding (recovery path for accounts that never finished it) ---
//
// Mirrors web `saveOnboardingProfile` / POST /api/profile/onboarding:
// `update_my_profile` writes the whole row (name, nickname, nim, university,
// class text); `join_class_by_name` turns the typed class name into ordinary
// membership when policy allows. Identity comes from the session.

data class ClassJoinResult(val status: String, val className: String? = null)

data class OnboardingSaveOutcome(
    val profile: MyProfile? = null,
    val classJoin: ClassJoinResult? = null,
    val fieldErrors: Map<String, String> = emptyMap(),
    val message: String? = null,
    val succeeded: Boolean = false,
)

/** Mirrors contracts profileOnboardingSchema (contracts/src/profile.ts). */
fun validateProfileOnboarding(
    fullName: String,
    nickname: String,
    nim: String,
    university: String,
    className: String,
): Map<String, String> {
    val errors = mutableMapOf<String, String>()
    val name = fullName.trim()
    val nick = nickname.trim()
    val id = nim.trim()
    val school = university.trim()
    val klass = className.trim()

    if (name.length < 2) errors["fullName"] = "Full name must be at least 2 characters"
    if (name.length > PROFILE_FULL_NAME_MAX) errors["fullName"] = "Full name must be $PROFILE_FULL_NAME_MAX characters or fewer"
    if (nick.length < 2) errors["nickname"] = "Nickname must be at least 2 characters"
    if (nick.length > PROFILE_NICKNAME_MAX) errors["nickname"] = "Nickname must be $PROFILE_NICKNAME_MAX characters or fewer"
    if (id.length < 3) errors["nim"] = "Enter your NIM"
    if (id.length > 32) errors["nim"] = "NIM must be 32 characters or fewer"
    if (!Regex("^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$").matches(id)) {
        errors["nim"] = "Use letters, digits, dot, underscore, or hyphen"
    }
    if (school.length < 2) errors["university"] = "Enter your university"
    if (school.length > 120) errors["university"] = "University must be 120 characters or fewer"
    if (klass.length > 60) errors["className"] = "Class name must be 60 characters or fewer"
    return errors
}

suspend fun joinClassByName(rawClassName: String): ClassJoinResult {
    val trimmed = rawClassName.trim()
    if (trimmed.isEmpty()) return ClassJoinResult(status = "no_match")
    val result = SupabaseProvider.client.postgrest.rpc(
        "join_class_by_name",
        kotlinx.serialization.json.buildJsonObject { put("p_class_name", trimmed) },
    )
    val obj = runCatching { result.decodeJsonObject() }.getOrNull()
        ?: return ClassJoinResult(status = "error")
    val status = obj["status"]?.jsonPrimitive?.contentOrNull() ?: "error"
    val name = obj["name"]?.jsonPrimitive?.contentOrNull()
    return ClassJoinResult(status = status, className = name)
}

/**
 * join_class_by_name matches active classes by slug/name; on a miss this
 * falls through to create_class_as_student, which opens the class and makes
 * the creator ketua via the class_members trigger. The slug fallback uses the
 * normalized key so the server accepts a typed name like "TPLM002".
 */
suspend fun joinOrCreateClass(className: String): ClassJoinResult {
    val joined = joinClassByName(className)

    if (joined.status != "no_match") {
        return joined
    }

    val trimmed = className.trim()
    val slug = slugifyClassName(trimmed)
    val year = java.util.Calendar.getInstance().get(java.util.Calendar.YEAR)

    val created = runCatching {
        SupabaseProvider.client.postgrest.rpc(
        "create_class_as_student",
        kotlinx.serialization.json.buildJsonObject {
            put("p_proposed_slug", slug)
            put("p_proposed_name", trimmed)
            put("p_course_name", trimmed)
            put("p_semester", "Ganjil")
            put("p_academic_year", "$year/${year + 1}")
            put("p_description", "Kelas yang dibuat saat onboarding oleh mahasiswa untuk $trimmed.")
            put("p_join_policy", "open")
        },
        )
    }

    return if (created.isSuccess) {
        ClassJoinResult(status = "joined", className = trimmed)
    } else {
        ClassJoinResult(status = "error")
    }
}

private fun slugifyClassName(value: String): String {
    val key = value
        .lowercase()
        .trim()
        .replace(Regex("[^a-z0-9]+"), "-")
        .replace(Regex("^-+|-+$"), "")
        .take(80)

    if (key.length >= 3) {
        return key
    }

    val digits = Regex("[a-zA-Z0-9]+").findAll(value)
        .map { it.value.lowercase() }
        .joinToString("")
    val fallback = (digits + "000").take(80)
    return if (fallback.length >= 3) fallback else "ko-kelas"
}

suspend fun saveOnboardingProfile(
    fullName: String,
    nickname: String,
    nim: String,
    university: String,
    className: String,
): OnboardingSaveOutcome {
    val errors = validateProfileOnboarding(fullName, nickname, nim, university, className)
    if (errors.isNotEmpty()) return OnboardingSaveOutcome(fieldErrors = errors)

    val db = SupabaseProvider.client.postgrest
    return try {
        db.rpc(
            "update_my_profile",
            kotlinx.serialization.json.buildJsonObject {
                put("p_full_name", fullName.trim())
                put("p_nickname", nickname.trim())
                put("p_nim", nim.trim())
                put("p_university", university.trim())
                put("p_declared_class", className.trim().takeIf { it.isNotEmpty() }?.let { JsonPrimitive(it) } ?: JsonNull)
            },
        )
        val join = if (className.trim().isNotEmpty()) {
            runCatching { joinOrCreateClass(className) }
                .getOrElse { ClassJoinResult(status = "error") }
        } else {
            null
        }
        val refreshed = loadMyProfile()
        OnboardingSaveOutcome(profile = refreshed, classJoin = join, succeeded = true)
    } catch (e: Exception) {
        val message = e.message?.lowercase().orEmpty()
        val outcome = if ("23505" in message || ("nim" in message && "unique" in message)) {
            OnboardingSaveOutcome(fieldErrors = mapOf("nim" to "That NIM is already registered."))
        } else {
            OnboardingSaveOutcome(message = friendlyProfileError(e))
        }
        outcome
    }
}
