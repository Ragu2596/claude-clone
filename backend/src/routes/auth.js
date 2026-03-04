import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

function genToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

function safeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    plan: user.plan || 'free',
  };
}

// ── Passport ──────────────────────────────────────────────────
passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user || false);
  } catch (e) { done(e); }
});

// ── Google Strategy ───────────────────────────────────────────
console.log('🔧 Setting up Google Strategy...');
console.log('   CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.slice(0, 20) + '...' : '❌ MISSING');
console.log('   CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '✅ set' : '❌ MISSING');
console.log('   CALLBACK_URL:', process.env.GOOGLE_CALLBACK_URL || '❌ MISSING');

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      proxy: true,
    },
    async (accessToken, refreshToken, profile, done) => {
      console.log('🔵 Google profile:', profile.id, profile.emails?.[0]?.value);
      try {
        const email = profile.emails?.[0]?.value;
        const name = profile.displayName || 'User';
        const avatar = profile.photos?.[0]?.value || null;
        const googleId = profile.id;

        if (!email) return done(new Error('No email from Google'));

        // Use upsert to avoid race conditions and prepared statement conflicts
        let user = await prisma.user.upsert({
          where: { googleId },
          update: {
            avatar: avatar || undefined,
          },
          create: {
            email,
            name,
            avatar,
            googleId,
            plan: 'free',
            msgCount: 0,
            msgResetDate: new Date(),
          },
        }).catch(async () => {
          // If googleId upsert fails, try by email
          return await prisma.user.upsert({
            where: { email },
            update: { googleId, avatar: avatar || undefined },
            create: {
              email,
              name,
              avatar,
              googleId,
              plan: 'free',
              msgCount: 0,
              msgResetDate: new Date(),
            },
          });
        });

        console.log('✅ Google login:', user.email, '| plan:', user.plan);
        return done(null, user);
      } catch (e) {
        console.error('❌ Google strategy error:', e.message);
        return done(e);
      }
    }
  ));
}

// ── Register ──────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'All fields required' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password min 6 characters' });
  try {
    if (await prisma.user.findUnique({ where: { email } }))
      return res.status(400).json({ error: 'Email already in use' });
    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, password: hashed, plan: 'free', msgCount: 0, msgResetDate: new Date() }
    });
    res.json({ token: genToken(user.id), user: safeUser(user) });
  } catch (e) {
    console.error('Register error:', e.message);
    res.status(500).json({ error: 'Registration failed: ' + e.message });
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
    res.json({ token: genToken(user.id), user: safeUser(user) });
  } catch (e) {
    console.error('Login error:', e.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── /auth/me ──────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return res.status(401).json({ error: 'User not found' });
    res.json(safeUser(user));
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// ── Stats ─────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return res.status(401).json({ error: 'User not found' });
    const limits = { free: 50, pro: 999999, enterprise: 999999 };
    const limit = limits[user.plan] || 50;
    res.json({
      plan: user.plan || 'free',
      messagesUsed: user.msgCount || 0,
      messagesLimit: limit,
      remaining: limit - (user.msgCount || 0),
    });
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// ── Upgrade plan ──────────────────────────────────────────────
router.post('/upgrade', async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
    const { plan } = req.body;
    if (!['free', 'pro', 'enterprise'].includes(plan))
      return res.status(400).json({ error: 'Invalid plan' });
    const user = await prisma.user.update({
      where: { id: decoded.userId },
      data: { plan }
    });
    res.json({ plan: user.plan });
  } catch (e) {
    res.status(500).json({ error: 'Upgrade failed' });
  }
});

// ── Google OAuth ──────────────────────────────────────────────
router.get('/google', (req, res, next) => {
  console.log('🚀 Starting Google OAuth...');
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

router.get('/google/callback', (req, res, next) => {
  console.log('📥 Google callback, session:', req.sessionID);
  passport.authenticate('google', (err, user, info) => {
    if (err) {
      console.error('❌ OAuth error:', err.message);
      return res.redirect(`${FRONTEND_URL}?error=google_failed&msg=${encodeURIComponent(err.message)}`);
    }
    if (!user) {
      console.error('❌ No user:', JSON.stringify(info));
      return res.redirect(`${FRONTEND_URL}?error=google_no_user`);
    }
    console.log('✅ Google login success:', user.email);
    return res.redirect(`${FRONTEND_URL}?token=${genToken(user.id)}`);
  })(req, res, next);
});

export default router;