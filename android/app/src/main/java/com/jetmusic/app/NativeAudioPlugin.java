package com.jetmusic.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
import android.content.ServiceConnection;
import android.os.Build;
import android.os.IBinder;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStreamReader;

/**
 * JS calls: NativeAudioPlayer.play(), .pause(), .resume(), .stop(), .seekTo(), .getStatus(), .setPlaylist()
 * Events:  "trackEnded", "playbackStateChanged", "error"
 */
@CapacitorPlugin(name = "NativeAudioPlayer")
public class NativeAudioPlugin extends Plugin implements MusicService.PlayerCallback {

    private MusicService musicService;
    private boolean isBound = false;

    private final ServiceConnection connection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder service) {
            try {
                MusicService.LocalBinder binder = (MusicService.LocalBinder) service;
                musicService = binder.getService();
                musicService.setCallback(NativeAudioPlugin.this);
                isBound = true;
            } catch (Exception e) {
                isBound = false;
                System.out.println("JetMusic: service bind failed: " + e.getMessage());
            }
        }
        @Override
        public void onServiceDisconnected(ComponentName name) {
            isBound = false;
        }
    };

    // ── Bind/unbind with activity lifecycle ──────────────

    @Override
    public void load() {
        super.load();
        bindService();
    }

    private void bindService() {
        if (isBound) return;
        Context ctx = getContext();
        Intent intent = new Intent(ctx, MusicService.class);
        try {
            ctx.startService(intent);
        } catch (Exception e) {
            // Safe fallback if background execution limits are active before player starts.
            // When playback begins, Media3 automatically transitions the bound service to foreground.
            System.out.println("JetMusic: startService failed, relying on bindService: " + e.getMessage());
        }
        ctx.bindService(intent, connection, Context.BIND_AUTO_CREATE);
    }

    @Override
    protected void handleOnStart() {
        super.handleOnStart();
        // Re-bind only if disconnected (e.g. after process restart)
        if (!isBound) bindService();
    }

    @Override
    protected void handleOnStop() {
        // ⚠️ DO NOT unbind here! We must keep the service connection alive while
        // the app is in the background so that JS→native calls (setPlaylist, pause,
        // getStatus) still work for track transitions and background playback control.
        super.handleOnStop();
    }

    @Override
    protected void handleOnDestroy() {
        // Only unbind when the activity is fully destroyed.
        super.handleOnDestroy();
        if (isBound) {
            try {
                getContext().unbindService(connection);
            } catch (Exception ignored) {}
            isBound = false;
        }
    }

    // ── Plugin Methods (called from JS) ──────────────────

    @PluginMethod
    public void setPlaylist(PluginCall call) {
        try {
            JSObject current = call.getObject("current");
            JSObject next    = call.getObject("next");

            if (current == null || !isBound || musicService == null) {
                call.reject("Invalid request or service not ready");
                return;
            }

            musicService.setPlaylist(current, next);
            call.resolve();
        } catch (Exception e) {
            call.reject("setPlaylist failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void play(PluginCall call) {
        String url      = call.getString("url");
        String title    = call.getString("title",    "Unknown");
        String artist   = call.getString("artist",   "");
        String coverUrl = call.getString("coverUrl", "");

        if (url == null || url.isEmpty()) {
            call.reject("url is required");
            return;
        }
        if (!isBound || musicService == null) {
            call.reject("MusicService not ready");
            return;
        }
        musicService.playUrl(url, title, artist, coverUrl);
        call.resolve();
    }

    @PluginMethod
    public void pause(PluginCall call) {
        if (isBound && musicService != null) musicService.pause();
        call.resolve();
    }

    @PluginMethod
    public void resume(PluginCall call) {
        if (isBound && musicService != null) musicService.resume();
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (isBound && musicService != null) musicService.stop();
        call.resolve();
    }

    @PluginMethod
    public void seekTo(PluginCall call) {
        Long posMs = call.getLong("posMs");
        if (posMs != null && isBound && musicService != null) {
            musicService.seekTo(posMs);
        }
        call.resolve();
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        Context ctx = getContext();
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        Uri uri = Uri.fromParts("package", ctx.getPackageName(), null);
        intent.setData(uri);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx.startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        if (isBound && musicService != null) {
            result.put("isPlaying",       musicService.isPlaying());
            result.put("currentPosition", musicService.getCurrentPosition());
            result.put("duration",        musicService.getDuration());
            result.put("ready",           true);
            result.put("serviceAlive",    true);
        } else {
            result.put("ready", false);
            result.put("serviceAlive", false);
        }
        call.resolve(result);
    }

    // ── MusicService.PlayerCallback events ───────────────

    /**
     * Read the crash log (if any) written by JetMusicApp's crash catcher.
     * Also returns app version + device info. Used by the debug overlay.
     */
    @PluginMethod
    public void getCrashLog(PluginCall call) {
        JSObject result = new JSObject();
        try {
            Context ctx = getContext();
            result.put("appVersion", ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0).versionName);
            result.put("appVersionCode", ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0).versionCode);
            result.put("device", android.os.Build.MANUFACTURER + " " + android.os.Build.MODEL
                    + " / Android " + android.os.Build.VERSION.RELEASE);

            File dir = ctx.getExternalFilesDir(null);
            if (dir == null) dir = ctx.getFilesDir();
            File log = new File(dir, "crash_log.txt");
            if (log.exists() && log.length() > 0) {
                StringBuilder sb = new StringBuilder();
                try (BufferedReader br = new BufferedReader(new InputStreamReader(new FileInputStream(log)))) {
                    String line;
                    while ((line = br.readLine()) != null) {
                        sb.append(line).append("\n");
                    }
                }
                result.put("exists", true);
                result.put("content", sb.toString());
            } else {
                result.put("exists", false);
            }
            call.resolve(result);
        } catch (Exception e) {
            call.reject("getCrashLog failed: " + e.getMessage());
        }
    }

    @Override
    public void onTrackEnded() {
        notifyListeners("trackEnded", new JSObject());
    }

    @Override
    public void onPlaybackStateChanged(boolean isPlaying) {
        JSObject data = new JSObject();
        data.put("isPlaying", isPlaying);
        notifyListeners("playbackStateChanged", data);
    }

    @Override
    public void onError(String message) {
        JSObject data = new JSObject();
        data.put("error", message);
        notifyListeners("error", data);
    }
}
