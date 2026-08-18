package com.jetmusic.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.webkit.WebView;
import android.Manifest;
import android.content.pm.PackageManager;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeAudioPlugin.class);
        super.onCreate(savedInstanceState);

        // ⚡ Battery Optimization Bypass: Standard for professional music apps
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                Intent intent = new Intent();
                intent.setAction(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + getPackageName()));
                startActivity(intent);
            }
        }

        // ⚡ Notification Permission Request for Android 13+ (Required for Foreground Service notifications)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, 101);
            }
        }

        // 🧬 NATIVE DNA INJECTION (V4.3.0)
        // We append a custom string to the User Agent so the WebGuard can instantly
        // identify this is the OFFICIAL NATIVE APK without waiting for Capacitor bridge.
        WebView webView = bridge.getWebView();
        if (webView != null) {
            String defaultUA = webView.getSettings().getUserAgentString();
            webView.getSettings().setUserAgentString(defaultUA + " JetMusicNative/1.0");
        }
    }

    /**
     * Prevent WebView from suspending JavaScript when the app goes to background.
     * This is critical for audio continuity in the WebView context.
     * We call super normally, then immediately re-resume the WebView.
     */
    @Override
    public void onPause() {
        super.onPause();
        WebView webView = bridge != null ? bridge.getWebView() : null;
        if (webView != null) {
            webView.onResume(); // re-enable JS timers = audio keeps playing
        }
    }

    @Override
    public void onStop() {
        super.onStop();
        WebView webView = bridge != null ? bridge.getWebView() : null;
        if (webView != null) {
            webView.onResume(); // re-enable JS timers = audio keeps playing
        }
    }
}
