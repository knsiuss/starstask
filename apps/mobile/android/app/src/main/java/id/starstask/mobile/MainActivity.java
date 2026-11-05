package id.starstask.mobile;

import android.os.Bundle;
import android.view.ViewGroup;
import android.widget.Button;

import com.getcapacitor.BridgeActivity;
import com.google.firebase.crashlytics.FirebaseCrashlytics;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        FirebaseCrashlytics.getInstance().setCrashlyticsCollectionEnabled(true);
        FirebaseCrashlytics.getInstance().sendUnsentReports();

        // Debug-only smoke test for Crashlytics setup (Firebase guide
        // Step 3). The button never appears in release builds.
        if (BuildConfig.DEBUG) {
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
