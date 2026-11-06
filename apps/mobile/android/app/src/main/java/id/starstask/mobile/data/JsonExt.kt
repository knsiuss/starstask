package id.starstask.mobile.data

import io.github.jan.supabase.postgrest.result.PostgrestResult
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.jsonPrimitive

/** Shared decode helper for Postgrest results (JsonArray of rows). */
fun PostgrestResult.decodeJsonArray(): JsonArray = decodeAs()
