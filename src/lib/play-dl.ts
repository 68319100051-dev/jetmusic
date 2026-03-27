import play from 'play-dl';

let initialized = false;

export async function initPlayDL() {
  if (initialized) return;
  
  try {
    const freeID = await play.getFreeClientID();
    await play.setToken({
      soundcloud: {
        client_id: freeID
      }
    });
    initialized = true;
    console.log('[PLAY-DL] Initialized with SoundCloud Client ID:', freeID);
  } catch (error: any) {
    console.error('[PLAY-DL] Initialization failed:', error.message);
  }
}

// 🚀 Pre-initialize on load to reduce first-click latency
if (typeof window === 'undefined') {
    initPlayDL().catch(console.error);
}

export default play;

