let cachedResult: { ngrokOnline: boolean } = { ngrokOnline: false };
let lastFetchTime = 0;
const CACHE_TTL = 10_000; // 10 seconds

export async function getNgrokStatus(): Promise<{ ngrokOnline: boolean }> {
  const now = Date.now();
  if (now - lastFetchTime < CACHE_TTL) {
    return cachedResult;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch('http://127.0.0.1:4040/api/tunnels', { signal: controller.signal });
    clearTimeout(timeout);
    cachedResult = { ngrokOnline: res.status === 200 };
  } catch {
    cachedResult = { ngrokOnline: false };
  }

  lastFetchTime = now;
  return cachedResult;
}
