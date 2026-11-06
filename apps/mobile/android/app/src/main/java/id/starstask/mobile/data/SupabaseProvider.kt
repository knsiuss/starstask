package id.starstask.mobile.data

import id.starstask.mobile.BuildConfig
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.auth.FlowType
import io.github.jan.supabase.auth.ExternalAuthAction
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.storage.Storage

/**
 * Supabase client for the native shell. Same project as web.
 *
 * Values come from local.properties (NOT committed):
 *   starstask.supabase.url=https://<ref>.supabase.co
 *   starstask.supabase.publishableKey=sb_publishable_...
 *
 * Only the public anon/publishable key belongs here — never the
 * service role key. OAuth returns through starstask://auth/callback.
 */
object SupabaseProvider {
    val client: SupabaseClient by lazy {
        createSupabaseClient(
            supabaseUrl = BuildConfig.SUPABASE_URL,
            supabaseKey = BuildConfig.SUPABASE_PUBLISHABLE_KEY,
        ) {
            install(Auth) {
                flowType = FlowType.PKCE
                host = "auth"
                scheme = "starstask"
                // Full system browser (not Custom Tab): Custom Tabs do not
                // reliably forward custom-scheme redirects back to the app
                // on all Android versions, landing the user on the web.
                defaultExternalAuthAction = ExternalAuthAction.ExternalBrowser
            }
            install(Postgrest)
            install(Storage)
        }
    }
}
