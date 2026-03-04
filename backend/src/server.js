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
const __dirname = dirname(__filename);

const uploadsDir = join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();

// ── CORS ──────────────────────────────────────────────────────
app.use(cors({
  origin: true,           // allow all origins in dev
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Session — resave:true is REQUIRED for Passport OAuth state ─
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-session-secret',
  resave: true,                // ← must be true for OAuth state to work
  saveUninitialized: true,     // ← must be true for OAuth state to work
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 10 * 60 * 1000,   // 10 mins is enough for OAuth handshake
  },
}));

app.use(passport.initialize());
app.use(passport.session());

app.use('/uploads', express.static(uploadsDir));

// ── Routes ────────────────────────────────────────────────────
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import conversationRoutes from './routes/conversations.js';
import projectRoutes from './routes/projects.js';

app.use('/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/projects', projectRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n✅ Server running → http://localhost:${PORT}`);
  console.log(`   Frontend URL : ${process.env.FRONTEND_URL}`);
  console.log(`   Google OAuth : ${process.env.GOOGLE_CLIENT_ID ? '✅' : '❌ NOT SET'}`);
  console.log(`   Callback URL : ${process.env.GOOGLE_CALLBACK_URL}`);
  console.log(`   Database     : ${process.env.DATABASE_URL ? '✅' : '❌ NOT SET'}\n`);
});