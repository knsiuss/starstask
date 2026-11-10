package id.starstask.mobile.data

/**
 * Maps an unexpected failure to a safe, user-facing sentence. Raw exception
 * text (Supabase/PostgREST/Postgres) contains internal details that must
 * never reach the UI: table names, constraint names, errcodes, and UUIDs.
 * Known codes map to a human sentence; anything else maps to `fallback`,
 * never to the raw message.
 */
fun userFacingMessage(
    error: Throwable?,
    fallback: String = "Something went wrong. Please try again.",
): String {
    val raw = error?.message?.lowercase().orEmpty()
    return when {
        "42501" in raw || "permission" in raw || "row-level security" in raw ->
            "You do not have permission to do this."
        "23505" in raw || "duplicate key" in raw ->
            "This already exists. Refresh and try again."
        "23514" in raw || "22023" in raw || "check constraint" in raw ->
            "Some required fields are missing or invalid. Try again."
        "23503" in raw || "foreign key" in raw ->
            "This item is still in use and cannot be changed."
        "p0002" in raw || "not found" in raw ->
            "That item could not be found."
        "network" in raw || "timeout" in raw || "timed out" in raw ||
            "socket" in raw || "connect" in raw || "unreachable" in raw ||
            "unknownhost" in raw ->
            "Network error. Check your connection and try again."
        else -> fallback
    }
}
