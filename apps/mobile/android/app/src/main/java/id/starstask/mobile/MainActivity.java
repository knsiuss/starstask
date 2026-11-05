package id.starstask.mobile;

import android.content.pm.ApplicationInfo;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.widget.Button;

import com.getcapacitor.BridgeActivity;
import com.google.firebase.crashlytics.FirebaseCrashlytics;

public class MainActivity extends BridgeActivity {
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
        }

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
}
