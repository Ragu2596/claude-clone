// backend/src/keepalive.js
// Pings /health every 14 minutes — keeps Render free tier alive.
// Tracks response time, logs warnings if slow, alerts on failures.

const INTERVAL_MS = 14 * 60 * 1000;
const TIMEOUT_MS  = 10_000;
const WARN_MS     = 3_000;

let pingCount = 0;
let failCount = 0;
let timer     = null;

async function ping(url) {
  const start      = Date.now();
  const controller = new AbortController();
  const abort      = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const ms  = Date.now() - start;
    clearTimeout(abort);
    if (!res.ok) {
      failCount++;
      console.error(`[keepalive] FAIL status=${res.status} ${ms}ms fails=${failCount}`);
      return;
    }
    pingCount++; failCount = 0;
    if (ms > WARN_MS) console.warn(`[keepalive] SLOW ${ms}ms pings=${pingCount}`);
    else              console.log(`[keepalive]  OK  ${ms}ms pings=${pingCount}`);
  } catch (e) {
    clearTimeout(abort); failCount++;
    const reason = e.name === 'AbortError' ? `timeout ${TIMEOUT_MS}ms` : e.message;
    console.error(`[keepalive] ERR ${reason} streak=${failCount}`);
    if (failCount >= 3) console.error('[keepalive] CRITICAL 3+ consecutive failures');
  }
}

export function startKeepAlive() {
  const url = process.env.KEEP_ALIVE_URL
    || `http://localhost:${process.env.PORT || 3001}/health`;
  console.log(`[keepalive] → ${url} every ${INTERVAL_MS / 60000}min`);
  setTimeout(() => ping(url), 30_000);
  timer = setInterval(() => ping(url), INTERVAL_MS);
}

export function stopKeepAlive() {
  if (timer) { clearInterval(timer); timer = null; }
}
export default App;
