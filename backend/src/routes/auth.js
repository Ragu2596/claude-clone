// backend/src/routes/auth.js
import express  from 'express';
import bcrypt   from 'bcryptjs';
import jwt      from 'jsonwebtoken';
import prisma   from '../lib/prisma.js';
import { config } from '../config/index.js';

const router = express.Router();

function genToken(userId) {
  return jwt.sign({ userId }, config.jwtSecret, { expiresIn: '30d' });
}

// GET /auth/debug
router.get('/debug', (req, res) => res.json({
  googleClientId: config.googleClientId ? config.googleClientId.slice(0, 20) + '...' : '❌ MISSING',
  googleSecret:   config.googleClientSec ? '✅ set' : '❌ MISSING',
  callbackUrl:    config.googleCallback  || '❌ MISSING',
  frontendUrl:    config.frontendUrl,
  nodeEnv:        config.nodeEnv,
  uptime:         Math.round(process.uptime()) + 's',
}));

// POST /auth/register
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
  if (password.length < 6)          return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    if (await prisma.user.findUnique({ where: { email } }))
      return res.status(400).json({ error: 'Email already in use' });
    const hash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { name, email, password: hash } });
    res.json({ token: genToken(user.id), user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar } });
  } catch (e) {
    console.error('Register error:', e.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password || !await bcrypt.compare(password, user.password))
      return res.status(401).json({ error: 'Invalid email or password' });
    res.json({ token: genToken(user.id), user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar } });
  } catch (e) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /auth/me
router.get('/me', async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { userId } = jwt.verify(header.split(' ')[1], config.jwtSecret);
    const user       = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(401).json({ error: 'User not found' });
    res.json({ id: user.id, name: user.name, email: user.email, avatar: user.avatar, plan: user.plan });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// GET /auth/google
router.get('/google', (req, res) => {
  if (!config.googleClientId || !config.googleClientSec)
    return res.redirect(`${config.frontendUrl}?error=google_not_configured`);
  const params = new URLSearchParams({ client_id: config.googleClientId, redirect_uri: config.googleCallback, response_type: 'code', scope: 'openid email profile', prompt: 'select_account', access_type: 'online' });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// GET /auth/google/callback
router.get('/google/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code)
    return res.redirect(`${config.frontendUrl}?error=google_failed&msg=${encodeURIComponent(error || 'no_code')}`);

  try {
    const tokenRes  = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: config.googleClientId, client_secret: config.googleClientSec, redirect_uri: config.googleCallback, grant_type: 'authorization_code' }).toString(),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token)
      return res.redirect(`${config.frontendUrl}?error=google_failed&msg=${encodeURIComponent(tokenData.error || 'token_failed')}`);

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
    const profile    = await profileRes.json();
    if (!profile.email) throw new Error('No email from Google');

    let user = await prisma.user.findUnique({ where: { googleId: profile.id } });
    if (!user) {
      user = await prisma.user.findUnique({ where: { email: profile.email } });
      if (user) {
        user = await prisma.user.update({ where: { id: user.id }, data: { googleId: profile.id, avatar: profile.picture || user.avatar } });
      } else {
        user = await prisma.user.create({ data: { email: profile.email, name: profile.name || 'User', avatar: profile.picture || null, googleId: profile.id } });
      }
    }

    res.redirect(`${config.frontendUrl}?token=${genToken(user.id)}`);
  } catch (e) {
    res.redirect(`${config.frontendUrl}?error=google_failed&msg=${encodeURIComponent(e.message)}`);
  }
});

export default router;