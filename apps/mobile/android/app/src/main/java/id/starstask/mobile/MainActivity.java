package id.starstask.mobile;

import android.content.pm.ApplicationInfo;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.widget.Button;

import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.exceptions.GetCredentialException;

import com.getcapacitor.BridgeActivity;
import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;
import com.google.firebase.auth.AuthResult;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.GoogleAuthProvider;
import com.google.firebase.crashlytics.FirebaseCrashlytics;

public class MainActivity extends BridgeActivity {
    /**
     * Web OAuth client ID from Google Cloud Console (the same project as
     * Firebase). Google native sign-in requires it to mint an ID token for
     * the server; the Supabase Google provider already uses this client.
     * TODO: paste the Web client ID here (or via build config) before
     * enabling native sign-in in production.
     */
    private static final String GOOGLE_WEB_CLIENT_ID = "TODO_WEB_CLIENT_ID";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        FirebaseCrashlytics.getInstance().setCrashlyticsCollectionEnabled(true);
        FirebaseCrashlytics.getInstance().sendUnsentReports();

        // Native feel: transparent status bar so the web UI blends in,
        // no address/progress chrome, no long-press context menu.
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);

        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.setLongClickable(false);
            webView.setOnLongClickListener(v -> true);
            webView.getSettings().setSupportZoom(false);

            // Some devices fail to draw WebView tiles with GPU rendering
            // (blank white page despite a rendered DOM). Software layer
            // rendering keeps content visible on those devices.
            webView.setLayerType(View.LAYER_TYPE_SOFTWARE, null);
            WebView.enableSlowWholeDocumentDraw();
            webView.postDelayed(
                    () -> {
                        // The WebView can come up measured at 0x0. Re-apply
                        // MATCH_PARENT and force a measure pass.
                        ViewGroup.LayoutParams params =
                                webView.getLayoutParams();
                        if (params != null) {
                            params.width = ViewGroup.LayoutParams.MATCH_PARENT;
                            params.height =
                                    ViewGroup.LayoutParams.MATCH_PARENT;
                            webView.setLayoutParams(params);
                        }
                        webView.invalidate();
                        webView.requestLayout();
                    },
                    1000);
        }

        // Native fallback login: on some devices the WebView never
        // rasterizes its text, leaving a blank page. Native views always
        // render, so the login entry point lives here too.
        Button loginButton = new Button(this);
        loginButton.setText("Sign in with Google");
        loginButton.setOnClickListener(
                v -> {
                    if (GOOGLE_WEB_CLIENT_ID.startsWith("TODO")) {
                        // Server client ID not configured yet: fall back to
                        // the in-page Custom Tab flow.
                        if (getBridge() != null && getBridge().getWebView() != null) {
                            getBridge()
                                    .getWebView()
                                    .evaluateJavascript(
                                            "document.getElementById('login')?.click()",
                                            null);
                        }
                        return;
                    }
                    signInWithGoogleNative();
                });
        addContentView(
                loginButton,
                new ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT));

        // Debug-only smoke test for Crashlytics setup (Firebase guide
        // Step 3). The button never appears in release builds.
        boolean debuggable =
                (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        if (debuggable) {
            Button crashButton = new Button(this);
            crashButton.setText("Test Crash");
            crashButton.setOnClickListener(
                    v -> {
                        throw new RuntimeException("Test Crash");
                    });
            addContentView(
                    crashButton,
                    new ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.WRAP_CONTENT));
        }
    }

    /**
     * Native Google sign-in via Credential Manager: the account picker and
     * consent stay inside the app (no browser), Firebase exchanges the ID
     * token, and the resulting ID token is handed to the WebView JS side
     * which trades it for a Supabase session.
     */
    private void signInWithGoogleNative() {
        CredentialManager credentialManager = CredentialManager.create(this);
        GetCredentialRequest request =
                new GetCredentialRequest.Builder()
                        .addCredentialOption(
                                new GetGoogleIdOption.Builder()
                                        .setServerClientId(GOOGLE_WEB_CLIENT_ID)
                                        .setFilterByAuthorizedAccounts(false)
                                        .build())
                        .build();

        credentialManager.getCredentialAsync(
                this,
                request,
                null,
                this::runOnUiThread,
                new CredentialManagerCallback<
                        androidx.credentials.GetCredentialResponse,
                        GetCredentialException>() {
                    @Override
                    public void onResult(
                            androidx.credentials.GetCredentialResponse response) {
                        androidx.credentials.Credential credential =
                                response.getCredential();
                        if (credential instanceof GoogleIdTokenCredential) {
                            String idToken =
                                    ((GoogleIdTokenCredential) credential)
                                            .getIdToken();
                            FirebaseAuth.getInstance()
                                    .signInWithCredential(
                                            GoogleAuthProvider.getCredential(
                                                    idToken, null))
                                    .addOnCompleteListener(
                                            task -> {
                                                if (!task.isSuccessful()) {
                                                    return;
                                                }
                                                AuthResult result =
                                                        task.getResult();
                                                if (result.getUser() == null) {
                                                    return;
                                                }
                                                result.getUser()
                                                        .getIdToken(false)
                                                        .addOnCompleteListener(
                                                                tokenTask -> {
                                                                    if (!tokenTask.isSuccessful()
                                                                            || tokenTask
                                                                                    .getResult()
                                                                                    .getToken()
                                                                            == null) {
                                                                        return;
                                                                    }
                                                                    String firebaseIdToken =
                                                                            tokenTask
                                                                                    .getResult()
                                                                                    .getToken();
                                                                    if (getBridge()
                                                                                    != null
                                                                            && getBridge()
                                                                                    .getWebView()
                                                                            != null) {
                                                                        getBridge()
                                                                                .getWebView()
                                                                                .evaluateJavascript(
                                                                                        "window.__nativeGoogleSignIn && window.__nativeGoogleSignIn("
                                                                                                + "\""
                                                                                                + firebaseIdToken
                                                                                                + "\")",
                                                                                        null);
                                                                    }
                                                                });
                                            });
                        }
                    }

                    @Override
                    public void onError(GetCredentialException e) {
                        // User dismissed the picker or provider unavailable:
                        // staying signed out is the correct fallback.
                    }
                });
    }
}
