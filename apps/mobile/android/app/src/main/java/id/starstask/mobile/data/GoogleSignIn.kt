package id.starstask.mobile.data

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import id.starstask.mobile.BuildConfig
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.Google
import io.github.jan.supabase.auth.providers.builtin.IDToken

/**
 * Native Google sign-in (no browser, like Facebook/X): Credential
 * Manager shows the account picker inside the app; the Google ID token
 * goes straight to Supabase via signInWith(Google) { idToken = ... }.
 * The Web client ID comes from local.properties
 * (starstask.google.webClientId) via BuildConfig — never hardcoded.
 */
suspend fun signInWithGoogleNative(context: Context): String? {
    val activityContext = context.findActivity() ?: return "Sign-in needs the app window."
    val webClientId = BuildConfig.GOOGLE_WEB_CLIENT_ID
    if (webClientId.startsWith("TODO")) {
        // Client ID not configured yet: browser flow as fallback.
        return try {
            SupabaseProvider.client.auth.signInWith(Google)
            null
        } catch (error: Exception) {
            "Browser sign-in failed: ${error.message}"
        }
    }

    val credentialManager = CredentialManager.create(activityContext)
    val request = GetCredentialRequest.Builder()
        .addCredentialOption(
            GetGoogleIdOption.Builder()
                .setServerClientId(webClientId)
                .setFilterByAuthorizedAccounts(false)
                .build()
        )
        .build()

    val response = try {
        credentialManager.getCredential(activityContext, request)
    } catch (error: Exception) {
        return "Google sign-in did not start: ${error.message}"
    }

    val credential = response.credential
    return if (credential is GoogleIdTokenCredential) {
        try {
            SupabaseProvider.client.auth.signInWith(IDToken) {
                idToken = credential.idToken
                provider = Google
            }
            null
        } catch (error: Exception) {
            "Sign-in failed: ${error.message}"
        }
    } else {
        "Unexpected credential from Google."
    }
}

private fun Context.findActivity(): android.app.Activity? {
    var current = this
    while (current is android.content.ContextWrapper) {
        if (current is android.app.Activity) return current
        current = current.baseContext
    }
    return null
}
