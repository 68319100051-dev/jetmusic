package com.jetmusic.app;

import android.app.Application;
import java.io.File;
import java.io.FileWriter;
import java.io.PrintWriter;

/**
 * Application-level crash catcher.
 * Writes the crash stack trace to a file so it can be read back later
 * (via NativeAudioPlugin.getCrashLog) and shown in the app's debug overlay.
 */
public class JetMusicApp extends Application {

    @Override
    public void onCreate() {
        super.onCreate();
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
}
