const https = require('https');

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxYnFPLmvE1vCxLXVG53Ja1qx2VIeMZAz1b2v1-Kgh1k5b1bgo5lZnGM5Y3--r-uKbd/exec";

function fetchUpdateInfo() {
  const data = JSON.stringify({ action: "VALIDATE_STARTUP", machineId: "TEST-ID" });

  const url = new URL(GOOGLE_SCRIPT_URL);
  const options = {
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  const req = https.request(options, (res) => {
    // Handle redirects
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      https.get(res.headers.location, (res2) => {
        let body = '';
        res2.on('data', (chunk) => body += chunk);
        res2.on('end', () => {
          console.log("RESPONSE FROM REDIRECT:");
          console.log(body);
        });
      });
      return;
    }

    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
      console.log("RESPONSE:");
      console.log(body);
    });
  });

  req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
  });

  req.write(data);
  req.end();
}

fetchUpdateInfo();
