const instances = [
  'https://invidious.nerdvpn.de',
  'https://invidious.weblibre.org',
  'https://iv.melmac.space',
  'https://vid.puffyan.us'
];

async function testInvidious() {
  const videoId = 'y3DMlK4o7Yc';
  
  for (const baseUrl of instances) {
    try {
      console.log(`Testing ${baseUrl}...`);
      const res = await fetch(`${baseUrl}/api/v1/videos/${videoId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      
      const audioStreams = data.adaptiveFormats.filter((f: any) => f.type.startsWith('audio/'));
      const bestAudio = audioStreams.sort((a:any, b:any) => parseInt(b.bitrate) - parseInt(a.bitrate))[0];
      
      console.log(`SUCCESS! URL: ${bestAudio.url.substring(0, 50)}...`);
      return;
    } catch (e: any) {
      console.error(`Failed ${baseUrl}:`, e.message);
    }
  }
}

testInvidious();
