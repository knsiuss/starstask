package id.starstask.mobile.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

// ---------------------------------------------------------------------------
// DataStore preferences (spec Phase 2): theme mode + what's-new dismissal.
// Replaces SharedPreferences for dashboard-owned settings.
// ---------------------------------------------------------------------------

private val Context.prefs: DataStore<Preferences> by preferencesDataStore(name = "starstask_prefs")

val THEME_MODE_KEY = stringPreferencesKey("theme_mode")
val WHATS_NEW_SEEN_KEY = stringPreferencesKey("whats_new_seen")

suspend fun setThemeMode(context: Context, mode: String) {
    context.prefs.edit { it[THEME_MODE_KEY] = mode }
}

suspend fun setWhatsNewSeen(context: Context, version: String) {
    context.prefs.edit { it[WHATS_NEW_SEEN_KEY] = version }
}

val HIDDEN_ASSIGNMENTS_KEY = stringPreferencesKey("hidden_assignments")

fun hiddenAssignmentsFlow(context: Context): Flow<Set<String>> =
    context.prefs.data.map { it[HIDDEN_ASSIGNMENTS_KEY]?.split(",")?.filter { s -> s.isNotBlank() }?.toSet() ?: emptySet() }

suspend fun hideAssignment(context: Context, assignmentId: String) {
    context.prefs.edit { prefs ->
        val current = prefs[HIDDEN_ASSIGNMENTS_KEY]?.split(",")?.filter { it.isNotBlank() }.orEmpty()
        prefs[HIDDEN_ASSIGNMENTS_KEY] = (current + assignmentId).distinct().joinToString(",")
    }
}

fun themeModeFlow(context: Context): Flow<String?> =
    context.prefs.data.map { it[THEME_MODE_KEY] }
