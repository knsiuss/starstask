package id.starstask.mobile.data

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import id.starstask.mobile.BuildConfig
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.Google
import io.github.jan.supabase.auth.providers.builtin.IDToken
import java.security.MessageDigest
import java.security.SecureRandom
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
            userFacingMessage(error, "Sign-in failed. Please try again.")
        }
    }

    // Hashed nonce goes to Google; the raw one is what Supabase verifies against the id_token.
    val rawNonce = ByteArray(32).also { SecureRandom().nextBytes(it) }
        .joinToString("") { "%02x".format(it) }
    val hashedNonce = sha256Hex(rawNonce)

    val credentialManager = CredentialManager.create(activityContext)
    val request = GetCredentialRequest.Builder()
        .addCredentialOption(
            GetGoogleIdOption.Builder()
                .setServerClientId(webClientId)
                .setFilterByAuthorizedAccounts(false)
                .setNonce(hashedNonce)
                .build()
        )
        .build()

    val response = try {
        credentialManager.getCredential(activityContext, request)
    } catch (error: Exception) {
        return userFacingMessage(error, "Google sign-in did not start. Please try again.")
    }

    val credential = response.credential
    var failureMessage = "Unexpected credential from Google."
    val googleCredential: GoogleIdTokenCredential? = when {
        credential is GoogleIdTokenCredential -> credential
        credential is CustomCredential &&
            credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL ->
            try {
                GoogleIdTokenCredential.createFrom(credential.data)
            } catch (error: Exception) {
                failureMessage = userFacingMessage(error, "Sign-in failed. Please try again.")
                null
            }
        else -> null
    }
    if (googleCredential == null) return failureMessage

    return try {
        SupabaseProvider.client.auth.signInWith(IDToken) {
            idToken = googleCredential.idToken
            provider = Google
            nonce = rawNonce
        }
        null
    } catch (error: Exception) {
        userFacingMessage(error, "Sign-in failed. Please try again.")
    }
}

private fun sha256Hex(value: String): String =
    MessageDigest.getInstance("SHA-256").digest(value.toByteArray())
        .joinToString("") { "%02x".format(it) }

private fun Context.findActivity(): android.app.Activity? {
    var current = this
    while (current is android.content.ContextWrapper) {
        if (current is android.app.Activity) return current
        current = current.baseContext
    }
    return null
}
