import { startKeepAlive } from './keepalive.js';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const uploadsDir = join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();

// ── CORS ──────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean).map(o => o.replace(/\/$/, ''));

console.log('🌐 Allowed origins:', allowedOrigins);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const clean = origin.replace(/\/$/, '');
    if (allowedOrigins.includes(clean)) return cb(null, true);
    console.warn('⚠️ CORS blocked:', origin);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials:    true,
  methods:        ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.options('*', cors());

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(session({
  secret:            process.env.SESSION_SECRET || 'dev-session-secret',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge:   10 * 60 * 1000,
  },
}));

app.use('/uploads', express.static(uploadsDir, { maxAge: '7d' }));

// ── Routes ────────────────────────────────────────────────────
import authRoutes         from './routes/auth.js';
import chatRoutes         from './routes/chat.js';
import conversationRoutes from './routes/conversations.js';
import projectRoutes      from './routes/projects.js';
import paymentRoutes      from './routes/payment.js';
import adminRoutes        from './routes/admin.js';       // 🆕 admin dashboard
import modelsRoutes       from './routes/models.js';      // 🆕 auto model sync
import supportRoutes      from './routes/support.js';

app.use('/auth',              authRoutes);
app.use('/api/chat',          chatRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/projects',      projectRoutes);
app.use('/payments',          paymentRoutes);
app.use('/api/admin',         adminRoutes);               // 🆕
app.use('/api/models',        modelsRoutes);              // 🆕
app.use('/api/support',       supportRoutes);

// ── Health ────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({
  status:  'ok',
  uptime:  Math.round(process.uptime()) + 's',
  origins: allowedOrigins,
}));

// ── Error handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  if (err.message.startsWith('CORS')) return res.status(403).json({ error: err.message });
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n✅ Server → http://localhost:${PORT}`);
  console.log(`   NODE_ENV  : ${process.env.NODE_ENV}`);
  console.log(`   Frontend  : ${process.env.FRONTEND_URL}`);
  console.log(`   Google    : ${process.env.GOOGLE_CLIENT_ID     ? '✅' : '❌'}`);
  console.log(`   Database  : ${process.env.DATABASE_URL         ? '✅' : '❌'}`);
  console.log(`   Groq      : ${process.env.GROQ_API_KEY         ? '✅' : '❌'}`);
  console.log(`   Gemini    : ${process.env.GEMINI_API_KEY       ? '✅' : '❌'}`);
  console.log(`   Razorpay  : ${process.env.RAZORPAY_KEY_ID      ? '✅' : '❌'}\n`);

  startKeepAlive();
});