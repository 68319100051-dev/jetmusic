package com.jetmusic.app;

import android.app.PendingIntent;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.annotation.Nullable;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.MediaItem;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;
import com.google.common.util.concurrent.ListenableFuture;
import com.google.common.util.concurrent.SettableFuture;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * JetMusic Global Standard Audio Service (V11 - MediaLibrary Edition)
 * Uses ExoPlayer + MediaLibraryService for Spotify-grade background stability.
 */
@UnstableApi
public class MusicService extends MediaSessionService {

    private ExoPlayer player;
    private MediaSession mediaSession;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    public interface PlayerCallback {
        void onTrackEnded();
        void onPlaybackStateChanged(boolean isPlaying);
        void onError(String message);
    }

    private PlayerCallback callback;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        initializePlayer();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    "jet_music_service",
                    "Jet Music Background Service",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Ensures background playback stability on aggressive devices.");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

    private void initializePlayer() {
        // 🌐 Chrome Spoofing: Prevent 403 Forbidden on streams
        String userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
        androidx.media3.datasource.DefaultHttpDataSource.Factory dataSourceFactory = new androidx.media3.datasource.DefaultHttpDataSource.Factory()
                .setUserAgent(userAgent)
                .setAllowCrossProtocolRedirects(true);

        player = new ExoPlayer.Builder(this)
                .setMediaSourceFactory(new androidx.media3.exoplayer.source.DefaultMediaSourceFactory(this).setDataSourceFactory(dataSourceFactory))
                .setAudioAttributes(
                        new AudioAttributes.Builder()
                                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                                .setUsage(C.USAGE_MEDIA)
                                .build(),
                        true)
                .setHandleAudioBecomingNoisy(true)
                .setWakeMode(C.WAKE_MODE_NETWORK)
                .build();

        player.addListener(new Player.Listener() {
            @Override
            public void onPlaybackStateChanged(int playbackState) {
                if (playbackState == Player.STATE_ENDED) {
                    if (callback != null) callback.onTrackEnded();
                }
            }

            @Override
            public void onIsPlayingChanged(boolean isPlaying) {
                if (callback != null) callback.onPlaybackStateChanged(isPlaying);
            }

            @Override
            public void onPlayerError(androidx.media3.common.PlaybackException error) {
                String msg = "Error [" + error.errorCode + "]: " + error.getMessage();
                if (callback != null) callback.onError(msg);
                
                // Show error right on the banner by updating player metadata
                if (player != null) {
                    MediaMetadata errorMeta = new MediaMetadata.Builder()
                            .setTitle("⚠️ Playback Error")
                            .setArtist(msg)
                            .build();
                    player.setPlaylistMetadata(errorMeta);
                }
            }
        });

        Intent intent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        mediaSession = new MediaSession.Builder(this, player)
                .setSessionActivity(pendingIntent)
                .build();

        // 🚨 Force early metadata initialization to trigger notification
        player.setPlaylistMetadata(new MediaMetadata.Builder()
                .setTitle("Jet Music")
                .setArtist("Ready to play")
                .build());
    }

    @Nullable
    @Override
    public MediaSession onGetSession(MediaSession.ControllerInfo controllerInfo) {
        return mediaSession;
    }

    // ── Helper methods for Plugin Bridge ─────────────────

    public void setCallback(PlayerCallback cb) { this.callback = cb; }

    public void setPlaylist(com.getcapacitor.JSObject current, com.getcapacitor.JSObject next) {
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                ensurePlayer();
                java.util.List<MediaItem> items = new java.util.ArrayList<>();
                
                // Current Track
                MediaItem currentItem = createMediaItem(
                    current.getString("url"), 
                    current.getString("title"), 
                    current.getString("artist"), 
                    current.getString("coverUrl")
                );
                items.add(currentItem);

                // Next Track (Optional)
                if (next != null && next.getString("url") != null) {
                    MediaItem nextItem = createMediaItem(
                        next.getString("url"), 
                        next.getString("title"), 
                        next.getString("artist"), 
                        next.getString("coverUrl")
                    );
                    items.add(nextItem);
                }

                player.stop();
                player.setMediaItems(items);
                player.prepare();
                player.play();
            } catch (Exception e) {
                if (callback != null) callback.onError("Playlist Error: " + e.getMessage());
            }
        });
    }

    private MediaItem createMediaItem(String url, String title, String artist, String coverUrl) {
        MediaMetadata metadata = new MediaMetadata.Builder()
                .setTitle(title != null ? title : "Jet Music")
                .setArtist(artist != null ? artist : "Jet Artist")
                .setArtworkUri((coverUrl != null && !coverUrl.trim().isEmpty()) ? Uri.parse(coverUrl) : null)
                .build();
        
        // Prevent Media3 IllegalArgumentException if URL is missing
        String safeUrl = (url != null && !url.trim().isEmpty()) ? url : "https://example.com/dummy.mp3";

        return new MediaItem.Builder()
                .setUri(safeUrl)
                .setMediaMetadata(metadata)
                .build();
    }

    public void playUrl(String url, String title, String artist, String coverUrl) {
        // Build metadata
        MediaMetadata.Builder metadataBuilder = new MediaMetadata.Builder()
                .setTitle(title != null ? title : "Jet Music")
                .setArtist(artist != null ? artist : "Jet Artist");

        // Load artwork asynchronously if possible
        if (coverUrl != null && !coverUrl.isEmpty()) {
            loadBitmapAndPlay(url, metadataBuilder, coverUrl);
        } else {
            startPlayback(url, metadataBuilder.build());
        }
    }

    private void loadBitmapAndPlay(String url, MediaMetadata.Builder metadataBuilder, String coverUrl) {
        executor.execute(() -> {
            try {
                URL artUrl = new URL(coverUrl);
                HttpURLConnection connection = (HttpURLConnection) artUrl.openConnection();
                connection.setDoInput(true);
                connection.connect();
                InputStream input = connection.getInputStream();
                Bitmap bitmap = BitmapFactory.decodeStream(input);
                if (bitmap != null) {
                    // Note: Media3 MediaMetadata doesn't take Bitmap directly easily in simple items.
                    // We'll use the URL and rely on System UI for the image.
                    metadataBuilder.setArtworkUri(Uri.parse(coverUrl));
                }
            } catch (Exception ignored) {}

            startPlayback(url, metadataBuilder.build());
        });
    }

    private void startPlayback(String url, MediaMetadata metadata) {
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                ensurePlayer();
                MediaItem mediaItem = new MediaItem.Builder()
                        .setUri(url)
                        .setMediaMetadata(metadata)
                        .build();
                player.stop();
                player.setMediaItem(mediaItem);
                player.prepare();
                player.play();
            } catch (Exception e) {
                if (callback != null) callback.onError("Playback Error: " + e.getMessage());
            }
        });
    }

    // Re-create the player if the service was recycled without a full onCreate
    private void ensurePlayer() {
        if (player == null) {
            initializePlayer();
        }
    }

    public void pause() { if (player != null) player.pause(); }
    public void resume() { if (player != null) player.play(); }
    public void stop() { if (player != null) player.stop(); }
    public void seekTo(long posMs) { if (player != null) player.seekTo(posMs); }

    public boolean isPlaying()         { return player != null && player.isPlaying(); }
    public long getCurrentPosition()   { return player != null ? player.getCurrentPosition() : 0L; }
    public long getDuration()          { return player != null ? player.getDuration() : 0L; }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        if (player != null) {
            if (!player.getPlayWhenReady() || player.getPlaybackState() == Player.STATE_IDLE || player.getPlaybackState() == Player.STATE_ENDED) {
                stopSelf();
            }
        } else {
            stopSelf();
        }
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        if (mediaSession != null) {
            mediaSession.release();
            mediaSession = null;
        }
        if (player != null) {
            player.release();
            player = null;
        }
        executor.shutdown();
        super.onDestroy();
    }

    // Required for plugin binding
    private final IBinder binder = new LocalBinder();
    public class LocalBinder extends android.os.Binder {
        public MusicService getService() { return MusicService.this; }
    }
    @Override
    public IBinder onBind(@Nullable Intent intent) {
        IBinder superBinder = super.onBind(intent);
        if (superBinder != null) {
            return superBinder;
        }
        return binder;
    }
}
