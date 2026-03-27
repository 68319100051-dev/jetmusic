const http = require('http');
http.get('http://localhost:3000/', (res) => {
  console.log('STATUS:', res.statusCode);
  let body = '';
  res.on('data', d => body += d.toString());
  res.on('end', () => {
    if (body.includes('<div id="__next"')) {
      console.log('App successfully requested.');
    }
    if (body.includes('Error:')) {
      console.log('Error found in HTML:', body.substring(body.indexOf('Error:') - 50, body.indexOf('Error:') + 200));
    } else {
      console.log('First 200 chars:', body.substring(0, 200));
    }
  });
});
