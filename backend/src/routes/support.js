// backend/src/routes/support.js
// Powers the Live Chat in Help & Support modal
// Uses Groq Llama 3.3 — FREE, fast, no user budget consumed
// ✅ Never calls external AI APIs directly from browser
// ✅ All AI goes through YOUR backend, YOUR API keys

import express from 'express';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

const SYSTEM_PROMPT = `You are a friendly, concise support assistant for rk.ai — an affordable AI chat app built for Indian users.

KEY FACTS ABOUT rk.ai:
- Plans: Free (₹0), Starter (₹199/mo), Pro (₹499/mo), Max (₹999/mo)
- Free models: Groq Llama 3.3 (Bolt/Rush/Dash), Gemini Flash/Pro (Nova/Stellar/Comet), Mistral (Breeze/Storm), Together AI (Titan/Depth/Orion) — all completely free
- Paid models: Claude Haiku/Flash (Starter+), GPT-4o Mini/Swift (Starter+), Claude Sonnet/Apex (Pro+), GPT-4o/Pulse (Pro+), Claude Opus/Prism (Max)
- Each paid model gives 3 FREE trial messages to test before upgrading — no risk
- Payments via Razorpay — UPI, cards, netbanking accepted. Pay in INR. No dollar conversion.
- Rate limits: 5-hour rolling window (like Claude Pro). Free=10, Starter=40, Pro=50, Max=100 per 5hrs
- File uploads (images, PDFs, docs) available on Starter plan and above
- Web search available via Perplexity models Scout/Trace (Starter+)
- No auto-renewal — plans are one-time payments, expire after 30 days, auto-drops to Free
- Knowledge cache: common questions are answered instantly from DB at zero cost
- Admin contact: ragunath2596@gmail.com

RULES:
- Keep answers SHORT — 2-3 sentences max
- Be warm, friendly, helpful
- If unsure, say "Please email ragunath2596@gmail.com for help"
- Never make up pricing or features not listed above`;

// POST /api/support/chat
router.post('/chat', authenticate, async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message required' });

    if (!process.env.GROQ_API_KEY) {
      return res.status(503).json({ error: 'Support chat unavailable. Please email ragunath2596@gmail.com' });
    }

    // Build message history (last 8 turns max — keep tokens low)
    const messages = [
      ...history.slice(-8).map(m => ({
        role:    m.role === 'user' ? 'user' : 'assistant',
        content: m.content || m.text || '',
      })),
      { role: 'user', content: message.trim() },
    ];

    // Call Groq — free, fast, no user budget consumed
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model:       'llama-3.3-70b-versatile',
        max_tokens:  250,
        temperature: 0.4,
        messages:    [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      }),
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      console.error('Groq support error:', err);
      throw new Error(`Groq error ${groqRes.status}`);
    }

    const data  = await groqRes.json();
    const reply = data.choices?.[0]?.message?.content?.trim()
      || "I'm not sure about that. Please email ragunath2596@gmail.com for help.";

    // Log for monitoring (visible in Render logs)
    console.log(`💬 Support [${req.user.email}]: "${message.slice(0, 50)}" → "${reply.slice(0, 60)}"`);

    res.json({ reply });
  } catch (e) {
    console.error('Support chat error:', e.message);
    res.status(500).json({
      error: 'Support chat unavailable right now. Please email ragunath2596@gmail.com',
    });
  }
});

export default router;