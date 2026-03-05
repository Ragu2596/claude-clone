import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import prisma from '../lib/prisma.js';
import dotenv from 'dotenv';
dotenv.config();

const router     = express.Router();
const JWT_SECRET = process.env.JWT_SECRET    || 'dev-secret';
const CLIENT_ID  = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SEC = process.env.GOOGLE_CLIENT_SECRET;
const CALLBACK   = process.env.GOOGLE_CALLBACK_URL;
const FRONTEND   = process.env.FRONTEND_URL  || 'http://localhost:5173';

function genToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

// ── Debug ─────────────────────────────────────────────────────
router.get('/debug', (req, res) => res.json({
  googleClientId: CLIENT_ID  ? CLIENT_ID.slice(0, 20) + '...' : '❌ MISSING',
  googleSecret:   CLIENT_SEC ? '✅ set' : '❌ MISSING',
  callbackUrl:    CALLBACK   || '❌ MISSING',
  frontendUrl:    FRONTEND,
  nodeEnv:        process.env.NODE_ENV,
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

// ────────────────────────────────────────────────────────────────────────────
// ✅ MANUAL GOOGLE OAUTH
// No passport. No session. No state parameter.
// Works perfectly on Render free tier (which loses sessions between requests).
// ────────────────────────────────────────────────────────────────────────────

// Step 1 — Redirect user to Google consent page
router.get('/google', (req, res) => {
  if (!CLIENT_ID || !CLIENT_SEC) {
    console.error('❌ Google OAuth not configured');
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

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  console.log('🚀 Google OAuth start → redirecting to Google');
  res.redirect(url);
});

// Step 2 — Google redirects back here with ?code=xxx
router.get('/google/callback', async (req, res) => {
  const { code, error } = req.query;
  console.log('📥 Google callback | code:', !!code, '| error:', error || 'none');

  if (error || !code) {
    console.error('❌ Google returned error:', error);
    return res.redirect(`${FRONTEND}?error=google_failed&msg=${encodeURIComponent(error || 'no_code')}`);
  }

  try {
    // Exchange code for access token
    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SEC,
      redirect_uri:  CALLBACK,
      grant_type:    'authorization_code',
    });

    const { access_token } = tokenRes.data;
    if (!access_token) throw new Error('No access token from Google');

    // Fetch user profile
    const profileRes = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const { id: googleId, email, name, picture: avatar } = profileRes.data;
    console.log('👤 Google profile fetched:', email);

    if (!email) throw new Error('No email returned from Google');

    // Upsert user
    let user = await prisma.user.findUnique({ where: { googleId } });

    if (!user) {
      user = await prisma.user.findUnique({ where: { email } });
      if (user) {
        // Existing email user — link Google account
        user = await prisma.user.update({
          where: { id: user.id },
          data:  { googleId, avatar: avatar || user.avatar },
        });
        console.log('🔗 Linked Google to existing account:', email);
      } else {
        // Brand new user
        user = await prisma.user.create({
          data: { email, name: name || 'User', avatar: avatar || null, googleId },
        });
        console.log('🆕 New user created:', email);
      }
    }

    const token = genToken(user.id);
    console.log('✅ Google login success:', email, '→ redirecting to', FRONTEND);
    return res.redirect(`${FRONTEND}?token=${token}`);

  } catch (e) {
    const msg = e.response?.data?.error_description || e.message;
    console.error('❌ Google callback error:', msg);
    return res.redirect(`${FRONTEND}?error=google_failed&msg=${encodeURIComponent(msg)}`);
  }
});

export default router;