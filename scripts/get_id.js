const https = require('https');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function getClientId() {
  try {
    console.log("Fetching SoundCloud home page...");
    const homeHTML = await get('https://soundcloud.com');
    const scriptUrls = homeHTML.match(/https:\/\/a-v2\.sndcdn\.com\/assets\/.[^"]+\.js/g);
    
    if (!scriptUrls) {
        console.log("No scripts found in HTML. Trying to find in script tags...");
        const altMatches = homeHTML.match(/src="([^"]+assets\/.[^"]+\.js)"/g);
        console.log("Found alt scripts:", altMatches);
        return;
    }

    console.log(`Checking ${scriptUrls.length} scripts...`);
    for (const url of scriptUrls.reverse()) {
      const content = await get(url);
      const match = content.match(/client_id:"([a-zA-Z0-9]{32})"/);
      if (match) {
        console.log(`SUCCESS: ${match[1]}`);
        return;
      }
    }
  } catch (e) {
    console.error("Error:", e.message);
  }
}

getClientId();
