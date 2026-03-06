const URL = process.env.RENDER_EXTERNAL_URL || 'https://claude-clone.onrender.com';

export function startKeepAlive() {
  if (process.env.NODE_ENV !== 'production') return;

  console.log('💓 Keep-alive started → pinging every 10 min');

  setInterval(async () => {
    try {
      const res = await fetch(`${URL}/health`);
      console.log('💓 Keep-alive ping OK:', res.status);
    } catch (e) {
      console.log('💔 Keep-alive ping failed:', e.message);
    }
  }, 10 * 60 * 1000); // every 10 minutes
}