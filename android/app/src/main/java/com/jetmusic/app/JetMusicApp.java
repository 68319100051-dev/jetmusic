package com.jetmusic.app;

import android.app.Application;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileWriter;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.PrintWriter;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Application-level crash catcher.
 * Writes the crash stack trace to a file so it can be read back later
 * (via NativeAudioPlugin.getCrashLog) and shown in the app's debug overlay.
 * Also auto-uploads the crash log to the server on the next app launch.
 */
public class JetMusicApp extends Application {

    @Override
    public void onCreate() {
        super.onCreate();
        uploadPendingCrashLog();
        Thread.UncaughtExceptionHandler defaultHandler = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            try {
                File dir = getExternalFilesDir(null);
                if (dir == null) dir = getFilesDir();
                File log = new File(dir, "crash_log.txt");
                try (PrintWriter pw = new PrintWriter(new FileWriter(log, false))) {
                    pw.println("=== JET MUSIC CRASH ===");
                    pw.println("Time: " + new java.util.Date().toString());
                    pw.println("Device: " + android.os.Build.MANUFACTURER + " "
                            + android.os.Build.MODEL + " (Android " + android.os.Build.VERSION.RELEASE + ")");
                    pw.println("VersionName: " + getPackageManager().getPackageInfo(getPackageName(), 0).versionName);
                    pw.println("VersionCode: " + getPackageManager().getPackageInfo(getPackageName(), 0).versionCode);
                    pw.println("Thread: " + thread.getName());
                    throwable.printStackTrace(pw);
                }
            } catch (Exception ignored) {}
            if (defaultHandler != null) {
                defaultHandler.uncaughtException(thread, throwable);
            } else {
                android.os.Process.killProcess(android.os.Process.myPid());
            }
        });
    }

    /**
     * If a crash_log.txt exists from a previous crash, POST it to the server
     * (fire-and-forget, retried on every launch until it succeeds).
     */
    private void uploadPendingCrashLog() {
        new Thread(() -> {
            try {
                File dir = getExternalFilesDir(null);
                if (dir == null) dir = getFilesDir();
                File log = new File(dir, "crash_log.txt");
                if (!log.exists() || log.length() == 0) return;

                StringBuilder sb = new StringBuilder();
                try (BufferedReader br = new BufferedReader(new InputStreamReader(new FileInputStream(log)))) {
                    String line;
                    while ((line = br.readLine()) != null) {
                        sb.append(line).append("\n");
                    }
                }
                String content = sb.toString();

                String appVersion = "";
                try {
                    appVersion = getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
                } catch (Exception ignored) {}

                String json = "{\"content\":" + escapeJson(content)
                        + ",\"device\":" + escapeJson(android.os.Build.MANUFACTURER + " " + android.os.Build.MODEL
                        + " (Android " + android.os.Build.VERSION.RELEASE + ")")
                        + ",\"appVersion\":" + escapeJson(appVersion) + "}";

                HttpURLConnection conn = (HttpURLConnection) new URL("https://jet-music.vercel.app/api/crash-report").openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(5000);
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(json.getBytes(StandardCharsets.UTF_8));
                }
                int code = conn.getResponseCode();
                conn.disconnect();

                if (code == 200 && log.exists()) {
                    log.delete();
                }
            } catch (Exception ignored) {}
        }).start();
    }

    private static String escapeJson(String s) {
        if (s == null) return "\"\"";
        StringBuilder sb = new StringBuilder("\"");
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"': sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                default:
                    if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
                    else sb.append(c);
            }
        }
        return sb.append('"').toString();
    }
}

