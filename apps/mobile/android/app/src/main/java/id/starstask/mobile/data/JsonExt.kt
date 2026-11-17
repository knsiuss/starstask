package id.starstask.mobile.data

import io.github.jan.supabase.postgrest.result.PostgrestResult
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.jsonPrimitive

/** Shared decode helper for Postgrest results (JsonArray of rows). */
fun PostgrestResult.decodeJsonArray(): JsonArray = decodeAs()

/** Shared decode helper for single-value RPC results (e.g. ids, booleans). */
fun PostgrestResult.decodeJsonPrimitive(): kotlinx.serialization.json.JsonPrimitive =
    decodeAs()

/** Shared decode helper for object RPC results (e.g. grade maps). */
fun PostgrestResult.decodeJsonObject(): kotlinx.serialization.json.JsonObject =
    decodeAs()
