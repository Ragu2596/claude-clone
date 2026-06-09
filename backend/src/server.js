// backend/src/server.js
import express      from 'express';
import cors         from 'cors';
import session      from 'express-session';
import fs           from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath }  from 'url';

import { config, logConfig } from './config/index.js';
import { startKeepAlive }    from './keepalive.js';

import authRoutes         from './routes/auth.js';
import chatRoutes         from './routes/chat.js';
import conversationRoutes from './routes/conversations.js';
import projectRoutes      from './routes/projects.js';
import paymentRoutes      from './routes/payment.js';
import adminRoutes        from './routes/admin.js';
import modelsRoutes       from './routes/models.js';
import supportRoutes      from './routes/support.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const uploadsDir = join(__dirname, '..', config.uploadDir);
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [config.frontendUrl, 'http://localhost:5173', 'http://localhost:3000']
  .filter(Boolean).map(o => o.replace(/\/$/, ''));

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ''))) return cb(null, true);
    console.warn('⚠️ CORS blocked:', origin);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-session'],
}));

app.options('*', cors());
app.use((_, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

// ── Body parsing ──────────────────────────────────────────────────────────────
// Stripe webhook needs raw body BEFORE express.json()
app.use('/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

app.use(session({
  secret: config.sessionSecret, resave: false, saveUninitialized: false,
  cookie: { secure: config.nodeEnv === 'production', httpOnly: true, maxAge: 10 * 60 * 1000 },
}));

app.use('/uploads', express.static(uploadsDir, { maxAge: '7d' }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/auth',              authRoutes);
app.use('/api/chat',          chatRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/projects',      projectRoutes);
app.use('/payments',          paymentRoutes);
app.use('/api/admin',         adminRoutes);
app.use('/api/models',        modelsRoutes);
app.use('/api/support',       supportRoutes);

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', uptime: Math.round(process.uptime()) + 's' }));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('❌ Unhandled error:', err.message);
  if (err.message.startsWith('CORS')) return res.status(403).json({ error: err.message });
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(config.port, () => {
  console.log(`\n✅ rk.ai server → http://localhost:${config.port}`);
  logConfig();
  startKeepAlive();
});