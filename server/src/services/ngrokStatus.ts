import http from 'http';

let cachedResult: { ngrokOnline: boolean } = { ngrokOnline: false };
let lastFetchTime = 0;
const CACHE_TTL = 10_000; // 10 seconds

function checkNgrok(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:4040/inspect/http', { timeout: 2000 }, (res) => {
      // Any response means ngrok is running
      res.resume(); // consume response data
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

export async function getNgrokStatus(): Promise<{ ngrokOnline: boolean }> {
  const now = Date.now();
  if (now - lastFetchTime < CACHE_TTL) {
    return cachedResult;
  }

  const online = await checkNgrok();
  cachedResult = { ngrokOnline: online };
  lastFetchTime = now;
  return cachedResult;
}
