import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jetmusic.app',
  appName: 'Jet Music',
  webDir: 'out',
  server: {
    url: 'https://jet-music.vercel.app',
    cleartext: true,
    allowNavigation: ['jet-music.vercel.app']
  },
  appendUserAgent: 'JetMusicNative/1.0'
};

export default config;
