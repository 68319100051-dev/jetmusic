async function testPiped() {
  const id = 'y3DMlK4o7Yc'; // ทางผ่าน - MILLI
  try {
    const res = await fetch(`https://pipedapi.kavin.rocks/streams/${id}`);
    const data = await res.json();
    console.log("Got data. audioStreams count:", data.audioStreams?.length);
    const m4a = data.audioStreams?.find((s: any) => s.mimeType === "audio/mp4" || s.mimeType === "audio/webm");
    console.log("Audio URL:", m4a?.url?.substring(0, 100) + '...');
  } catch (e) {
    console.error(e);
  }
}

testPiped();
