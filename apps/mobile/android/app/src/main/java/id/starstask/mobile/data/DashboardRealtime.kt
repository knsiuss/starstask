package id.starstask.mobile.data

import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.postgresChangeFlow
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.merge

// ---------------------------------------------------------------------------
// Dashboard realtime (web DashboardRealtime): INSERT/UPDATE/DELETE on the
// dashboard source tables triggers a refresh. The UI debounces (3s) so a
// burst of writes causes at most one refresh per window.
// ---------------------------------------------------------------------------

private val DASHBOARD_TABLES = listOf(
    "assignments",
    "discussion_sessions",
    "class_memberships",
)

/** Emits on any change to a dashboard source table. Caller must collect. */
fun dashboardChanges(): Flow<PostgresAction> {
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
            merge(*flows.toTypedArray()).collect { emit(it) }
        } finally {
            myChannel.unsubscribe()
        }
    }
}
