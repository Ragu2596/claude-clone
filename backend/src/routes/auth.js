import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import dotenv from 'dotenv';
dotenv.config();

const router     = express.Router();
const JWT_SECRET = process.env.JWT_SECRET         || 'dev-secret';
const CLIENT_ID  = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SEC = process.env.GOOGLE_CLIENT_SECRET;
const CALLBACK   = process.env.GOOGLE_CALLBACK_URL;
const FRONTEND   = process.env.FRONTEND_URL        || 'http://localhost:5173';

function genToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

// ── Debug ─────────────────────────────────────────────────────
router.get('/debug', (req, res) => res.json({
  googleClientId: CLIENT_ID  ? CLIENT_ID.slice(0, 30) + '...' : '❌ MISSING',
  googleSecret:   CLIENT_SEC ? '✅ set' : '❌ MISSING',
  callbackUrl:    CALLBACK   || '❌ MISSING',
  frontendUrl:    FRONTEND,
  nodeEnv:        process.env.NODE_ENV,
  nodeVersion:    process.version,
}));

// ── Register ──────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'All fields required' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    if (await prisma.user.findUnique({ where: { email } }))
      return res.status(400).json({ error: 'Email already in use' });
    const hash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { name, email, password: hash } });
    console.log('✅ Register:', user.email);
    res.json({
      token: genToken(user.id),
      user:  { id: user.id, name: user.name, email: user.email, avatar: user.avatar },
    });
  } catch (e) {
    console.error('❌ Register error:', e.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ── Login ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required' });
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password)
      return res.status(401).json({ error: 'Invalid email or password' });
    if (!await bcrypt.compare(password, user.password))
      return res.status(401).json({ error: 'Invalid email or password' });
    console.log('✅ Login:', user.email);
    res.json({
      token: genToken(user.id),
      user:  { id: user.id, name: user.name, email: user.email, avatar: user.avatar },
    });
  } catch (e) {
    console.error('❌ Login error:', e.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── Me ────────────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { userId } = jwt.verify(header.split(' ')[1], JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(401).json({ error: 'User not found' });
    res.json({ id: user.id, name: user.name, email: user.email, avatar: user.avatar, plan: user.plan });
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// ─────────────────────────────────────────────────────────────
// ✅ MANUAL GOOGLE OAUTH — uses Node built-in fetch (Node 18+)
//    No passport. No axios. No session. No state. Bulletproof.
// ─────────────────────────────────────────────────────────────

// Step 1 — Send user to Google
router.get('/google', (req, res) => {
  if (!CLIENT_ID || !CLIENT_SEC) {
    console.error('❌ Google not configured');
    return res.redirect(`${FRONTEND}?error=google_not_configured`);
  }
  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  CALLBACK,
    response_type: 'code',
    scope:         'openid email profile',
    prompt:        'select_account',
    access_type:   'online',
  });
  console.log('🚀 Google OAuth → redirecting, callback:', CALLBACK);
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// Step 2 — Google sends code back here
router.get('/google/callback', async (req, res) => {
  const { code, error } = req.query;
  console.log('📥 Google callback | has code:', !!code, '| error:', error || 'none');

  if (error || !code) {
    return res.redirect(`${FRONTEND}?error=google_failed&msg=${encodeURIComponent(error || 'no_code')}`);
  }

  try {
    // Exchange code → access token using built-in fetch
    const tokenBody = new URLSearchParams({
      code,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SEC,
      redirect_uri:  CALLBACK,
      grant_type:    'authorization_code',
    });

    console.log('🔄 Exchanging code for token...');
    const tokenRes  = await fetch('https://oauth2.googleapis.com/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    tokenBody.toString(),
    });
    const tokenData = await tokenRes.json();

    console.log('📦 Token response status:', tokenRes.status);

    if (!tokenRes.ok || !tokenData.access_token) {
      const errMsg = tokenData.error_description || tokenData.error || 'token_exchange_failed';
      console.error('❌ Token exchange failed:', errMsg, JSON.stringify(tokenData));
      return res.redirect(`${FRONTEND}?error=google_failed&msg=${encodeURIComponent(errMsg)}`);
    }

    // Fetch profile using access token
    console.log('🔄 Fetching user profile...');
    const profileRes  = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();

    console.log('👤 Profile:', profile.email);

    if (!profile.email) throw new Error('No email from Google');

    // Upsert user in DB
    let user = await prisma.user.findUnique({ where: { googleId: profile.id } });

    if (!user) {
      user = await prisma.user.findUnique({ where: { email: profile.email } });
      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data:  { googleId: profile.id, avatar: profile.picture || user.avatar },
        });
        console.log('🔗 Linked Google to existing account:', profile.email);
      } else {
        user = await prisma.user.create({
          data: {
            email:    profile.email,
            name:     profile.name || 'User',
            avatar:   profile.picture || null,
            googleId: profile.id,
          },
        });
        console.log('🆕 New user:', profile.email);
      }
    }

    const token = genToken(user.id);
    console.log('✅ Google login success:', profile.email, '→', FRONTEND);
    return res.redirect(`${FRONTEND}?token=${token}`);

  } catch (e) {
    console.error('❌ OAuth callback crash:', e.message);
    return res.redirect(`${FRONTEND}?error=google_failed&msg=${encodeURIComponent(e.message)}`);
  }
});

export default router;