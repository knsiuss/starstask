package id.starstask.mobile.data

import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.postgresChangeFlow
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.merge

// ---------------------------------------------------------------------------
// Dashboard realtime (web DashboardRealtime): INSERT/UPDATE/DELETE on the
// dashboard source tables triggers a refresh. Debounced (3s) so a burst of
// writes causes at most one tick per window. Callers collect; subscribe
// failure throws inside the flow so the UI can fall back to manual refresh.
// ---------------------------------------------------------------------------

private val DASHBOARD_TABLES = listOf(
    "assignments",
    "discussion_sessions",
    "class_memberships",
)

/** Emits a tick on any change to a dashboard source table. */
@OptIn(kotlinx.coroutines.FlowPreview::class)
fun dashboardChanges(): Flow<Unit> {
    val client = SupabaseProvider.client
    val myChannel = client.channel("dashboard")
    val flows = DASHBOARD_TABLES.map { table ->
        myChannel.postgresChangeFlow<PostgresAction>(schema = "public") {
            this.table = table
        }
    }
    return flow {
        myChannel.subscribe()
        try {
            merge(*flows.toTypedArray())
                .debounce(3_000)
                .map { }
                .collect { emit(it) }
        } finally {
            myChannel.unsubscribe()
        }
    }
}
