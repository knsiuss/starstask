package id.starstask.mobile.data

// Short-TTL in-memory cache mirroring web listAssignments (Redis, 15s).
// Same cache key shape as web: search|course|semester|type|tag|class|sort|page|pageSize.

private const val LISTING_CACHE_TTL_MS = 15_000

private data class CacheEntry(val createdMs: Long, val page: AssignmentPage)

private val listingCache = mutableMapOf<String, CacheEntry>()

internal fun listingCacheKey(
    search: String?,
    course: String?,
    semester: String?,
    type: String?,
    tag: String?,
    clazz: String?,
    sort: String,
    page: Int,
    pageSize: Int,
): String = listOf(
    search.orEmpty(),
    course.orEmpty(),
    semester.orEmpty(),
    type.orEmpty(),
    tag.orEmpty(),
    clazz.orEmpty(),
    sort,
    page,
    pageSize,
).joinToString("|")

internal fun cachedListing(key: String): AssignmentPage? {
    val entry = listingCache[key] ?: return null
    if (System.currentTimeMillis() - entry.createdMs > LISTING_CACHE_TTL_MS) {
        listingCache.remove(key)
        return null
    }
    return entry.page
}

internal fun storeListing(key: String, page: AssignmentPage) {
    listingCache[key] = CacheEntry(System.currentTimeMillis(), page)
}

internal fun clearListingCache() {
    listingCache.clear()
}
