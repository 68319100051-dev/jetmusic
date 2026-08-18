import { get, set, del, keys } from 'idb-keyval';

export interface TrackData {
  id: string;
  title: string;
  artist: string;
  album?: string;
  coverUrl: string;
  audioSrc?: string;
  duration?: number;
}

export interface OfflineTrack extends TrackData {
  audioBlob: Blob;
  downloadedAt: number;
}

export const downloadTrack = async (track: TrackData, streamUrl?: string): Promise<boolean> => {
  try {
    // Determine the true audio URL
    const isYT = track.audioSrc?.includes('youtube.com') || track.audioSrc?.includes('youtu.be');
    const audioUrl = streamUrl || (isYT ? `/api/stream?id=${encodeURIComponent(track.audioSrc!)}` : track.audioSrc);
    
    if (!audioUrl) throw new Error("No valid audio URL to download.");

    console.log(`[JET Offline] Fetching audio for ${track.title}...`);
    const response = await fetch(audioUrl);
    if (!response.ok) throw new Error("Failed to fetch stream.");

    const blob = await response.blob();
    
    const offlineTrack: OfflineTrack = {
       ...track,
       audioBlob: blob,
       downloadedAt: Date.now()
    };
    
    await set(`offline_track_${track.id}`, offlineTrack);
    console.log(`[JET Offline] Saved ${track.title} successfully!`);
    return true;
  } catch (error) {
    console.error("[JET Offline] Download error:", error);
    return false;
  }
};

export const getOfflineTrackUrl = async (trackId: string): Promise<string | null> => {
   try {
      const data = await get<OfflineTrack>(`offline_track_${trackId}`);
      if (data && data.audioBlob) {
         // Generate a swift memory URL for the audio player
         return URL.createObjectURL(data.audioBlob);
      }
      return null;
   } catch (e) {
      console.error("[JET Offline] Error creating object URL:", e);
      return null;
   }
};

export const removeOfflineTrack = async (trackId: string): Promise<void> => {
   await del(`offline_track_${trackId}`);
};

export const getAllOfflineTracks = async (): Promise<TrackData[]> => {
   try {
      const allKeys = await keys();
      const trackKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith('offline_track_'));
      const tracks: TrackData[] = [];
      
      for (const k of trackKeys) {
         const t = await get<OfflineTrack>(k as string);
         if (t) {
            // Return metadata without loading the heavy blobs
            const { audioBlob, ...metadata } = t;
            tracks.push(metadata);
         }
      }
      return tracks.sort((a: any, b: any) => b.downloadedAt - a.downloadedAt);
   } catch (e) {
      console.error("[JET Offline] Failed to get offline tracks", e);
      return [];
   }
};

export const checkIsTrackOffline = async (trackId: string): Promise<boolean> => {
   try {
      const data = await get(`offline_track_${trackId}`);
      return !!data;
   } catch (e) {
      return false;
   }
};
