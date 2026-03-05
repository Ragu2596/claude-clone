import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import prisma from '../lib/prisma.js';
import dotenv from 'dotenv';
dotenv.config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function genToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

// ── Passport setup ────────────────────────────────────────────
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user || false);
  } catch (e) { done(e); }
});

// ── Google Strategy ───────────────────────────────────────────
console.log('🔧 Google OAuth Setup:');
console.log('   CLIENT_ID    :', process.env.GOOGLE_CLIENT_ID     ? '✅' : '❌ MISSING');
console.log('   CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '✅' : '❌ MISSING');
console.log('   CALLBACK_URL :', process.env.GOOGLE_CALLBACK_URL  || '❌ MISSING');
console.log('   FRONTEND_URL :', process.env.FRONTEND_URL         || '❌ MISSING');

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  process.env.GOOGLE_CALLBACK_URL,
      proxy:        true,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email   = profile.emails?.[0]?.value;
        const name    = profile.displayName || 'User';
        const avatar  = profile.photos?.[0]?.value || null;
        const googleId = profile.id;

        if (!email) return done(new Error('No email from Google'));

        let user = await prisma.user.findUnique({ where: { googleId } });

        if (!user) {
          user = await prisma.user.findUnique({ where: { email } });
          if (user) {
            user = await prisma.user.update({
              where: { id: user.id },
              data:  { googleId, avatar: avatar || user.avatar },
            });
          } else {
            user = await prisma.user.create({
              data: { email, name, avatar, googleId },
            });
          }
        }

        console.log('✅ Google login:', user.email);
        return done(null, user);
      } catch (e) {
        console.error('❌ Google strategy error:', e.message);
        return done(e);
      }
    }
  ));
}

// ── Debug ─────────────────────────────────────────────────────
router.get('/debug', (req, res) => {
  res.json({
    googleConfigured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    callbackUrl:      process.env.GOOGLE_CALLBACK_URL,
    frontendUrl:      process.env.FRONTEND_URL,
    sessionWorks:     !!req.session,
    sessionID:        req.sessionID,
  });
});

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

    const hashed = await bcrypt.hash(password, 12);
    const user   = await prisma.user.create({
      data: { name, email, password: hashed },
    });

    res.json({
      token: genToken(user.id),
      user:  { id: user.id, name: user.name, email: user.email, avatar: user.avatar },
    });
  } catch (e) {
    console.error('Register error:', e.message);
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

    res.json({
      token: genToken(user.id),
      user:  { id: user.id, name: user.name, email: user.email, avatar: user.avatar },
    });
  } catch (e) {
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

// ── Google OAuth start ────────────────────────────────────────
router.get('/google', (req, res, next) => {
  console.log('🚀 Starting Google OAuth, session:', req.sessionID);
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account',   // always show account picker
  })(req, res, next);
});

// ── Google OAuth callback ─────────────────────────────────────
router.get('/google/callback', (req, res, next) => {
  console.log('📥 Google callback, session:', req.sessionID, 'query:', JSON.stringify(req.query));

  passport.authenticate('google', { session: false }, (err, user) => {
    const FE = process.env.FRONTEND_URL || 'http://localhost:5173';
    console.log('🌐 Redirecting to:', FE);

    if (err) {
      console.error('❌ OAuth error:', err.message);
      return res.redirect(`${FE}?error=google_failed&msg=${encodeURIComponent(err.message)}`);
    }
    if (!user) {
      console.error('❌ No user returned from Google');
      return res.redirect(`${FE}?error=google_no_user`);
    }

    const token = genToken(user.id);
    console.log('✅ Google success:', user.email, '→', FE);
    return res.redirect(`${FE}?token=${token}`);
  })(req, res, next);
});

export default router;