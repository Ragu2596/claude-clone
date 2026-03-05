import express from 'express';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// ── Uploads directory ─────────────────────────────────────────
const uploadsDir = join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();

// ── CORS ──────────────────────────────────────────────────────
app.use(cors({
  origin:         process.env.FRONTEND_URL || true,
  credentials:    true,
  methods:        ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body parsers ──────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Session (required for Google OAuth state) ─────────────────
app.use(session({
  secret:           process.env.SESSION_SECRET || 'dev-session-secret',
  resave:           true,
  saveUninitialized: true,
  cookie: {
    secure:   process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge:   10 * 60 * 1000, // 10 mins — enough for OAuth
  },
}));

app.use(passport.initialize());
app.use(passport.session());

// ── Static uploads ────────────────────────────────────────────
app.use('/uploads', express.static(uploadsDir));

// ── Routes ────────────────────────────────────────────────────
import authRoutes         from './routes/auth.js';
import chatRoutes         from './routes/chat.js';
import conversationRoutes from './routes/conversations.js';
import projectRoutes      from './routes/projects.js';
import paymentRoutes      from './routes/payment.js';

app.use('/auth',              authRoutes);
app.use('/api/chat',          chatRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/projects',      projectRoutes);
app.use('/payments',          paymentRoutes);

// ── Health check ──────────────────────────────────────────────
app.get('/health', (req, res) => res.json({
  status:    'ok',
  timestamp: new Date().toISOString(),
  env:       process.env.NODE_ENV,
}));

// ── Global error handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n✅ Server running → http://localhost:${PORT}`);
  console.log(`   NODE_ENV     : ${process.env.NODE_ENV}`);
  console.log(`   Frontend URL : ${process.env.FRONTEND_URL}`);
  console.log(`   Google OAuth : ${process.env.GOOGLE_CLIENT_ID     ? '✅' : '❌ NOT SET'}`);
  console.log(`   Callback URL : ${process.env.GOOGLE_CALLBACK_URL  || '❌ NOT SET'}`);
  console.log(`   Database     : ${process.env.DATABASE_URL         ? '✅' : '❌ NOT SET'}`);
  console.log(`   Groq         : ${process.env.GROQ_API_KEY         ? '✅' : '❌ NOT SET'}`);
  console.log(`   Gemini       : ${process.env.GEMINI_API_KEY       ? '✅' : '❌ NOT SET'}`);
  console.log(`   Anthropic    : ${process.env.ANTHROPIC_API_KEY    ? '✅' : '❌ NOT SET'}`);
  console.log(`   Razorpay     : ${process.env.RAZORPAY_KEY_ID      ? '✅' : '❌ NOT SET'}\n`);
});