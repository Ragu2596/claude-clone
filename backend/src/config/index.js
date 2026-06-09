// backend/src/config/index.js
// Single source of truth for all environment config.
// Import this everywhere instead of calling process.env directly.

import dotenv from 'dotenv';
dotenv.config();

function require(name) {
  const val = process.env[name];
  if (!val) console.warn(`⚠️  Missing env var: ${name}`);
  return val || '';
}

export const config = {
  // Server
  port:        process.env.PORT        || 3001,
  nodeEnv:     process.env.NODE_ENV    || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  uploadDir:   process.env.UPLOAD_DIR  || 'uploads',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10_485_760, // 10MB

  // Auth
  jwtSecret:        process.env.JWT_SECRET         || 'dev-secret',
  sessionSecret:    process.env.SESSION_SECRET      || 'dev-session-secret',
  googleClientId:   process.env.GOOGLE_CLIENT_ID    || '',
  googleClientSec:  process.env.GOOGLE_CLIENT_SECRET || '',
  googleCallback:   process.env.GOOGLE_CALLBACK_URL  || '',

  // AI providers
  anthropicKey:    process.env.ANTHROPIC_API_KEY    || '',
  openaiKey:       process.env.OPENAI_API_KEY       || '',
  groqKey:         process.env.GROQ_API_KEY         || '',
  geminiKey:       process.env.GEMINI_API_KEY       || '',
  mistralKey:      process.env.MISTRAL_API_KEY      || '',
  togetherKey:     process.env.TOGETHER_API_KEY     || '',
  perplexityKey:   process.env.PERPLEXITY_API_KEY   || '',

  // Payments
  razorpayKeyId:     process.env.RAZORPAY_KEY_ID     || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',

  // Admin
  adminEmail: process.env.ADMIN_EMAIL || '',
};

// Log key status on startup
export function logConfig() {
  const check = (label, val) => `${val ? '✅' : '❌'} ${label}`;
  console.log(`
  ${check('Anthropic',  config.anthropicKey)}
  ${check('OpenAI',     config.openaiKey)}
  ${check('Groq',       config.groqKey)}
  ${check('Gemini',     config.geminiKey)}
  ${check('Google Auth',config.googleClientId)}
  ${check('Razorpay',   config.razorpayKeyId)}
  ${check('Database',   process.env.DATABASE_URL)}
  `);
}