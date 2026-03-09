// backend/src/routes/admin.js
// Role-based admin system
//
// ROLES:
//   superadmin — full access + can add/remove admins + change roles
//   admin      — full access to dashboard data, cannot manage admins
//   viewer     — read-only, cannot see user emails (privacy)
//
// FLOW:
//   1. User visits /#/admin
//   2. Must be logged in (JWT)
//   3. Email must exist in AdminUser table AND active=true
//   4. Must pass OTP sent to their email
//   5. Role determines what they can see/do

import express    from 'express';
import nodemailer from 'nodemailer';
import { authenticate } from '../middleware/auth.js';
import { getAllUserStats, getBusinessSummary } from '../services/costTracker.js';
import { PrismaClient } from '@prisma/client';

const prisma  = new PrismaClient();
const router  = express.Router();

// ── OTP + Session store (in-memory, expires automatically) ───
const otpStore = new Map();

// ── Mailer ───────────────────────────────────────────────────
function getMailer() {
  return nodemailer.createTransport({
    host:   'smtp.gmail.com',
    port:   465,
    secure: true,           // SSL
    auth: {
      user: process.env.ADMIN_EMAIL,
      pass: process.env.GMAIL_APP_PASSWORD,  // Google App Password
    },
  });
}

// ── Check if user is an active admin (any role) ──────────────
async function getAdminUser(email) {
  // Superadmin (from env) is always allowed — auto-create if not in DB
  if (email === process.env.ADMIN_EMAIL) {
    let admin = await prisma.adminUser.findUnique({ where: { email } });
    if (!admin) {
      admin = await prisma.adminUser.create({
        data: { email, name: 'Super Admin', role: 'superadmin', addedBy: 'system', active: true },
      });
      console.log('✅ Super admin auto-created in AdminUser table');
    }
    return admin;
  }
  return prisma.adminUser.findUnique({ where: { email, active: true } });
}

// ── Middleware: must be active admin ─────────────────────────
async function isAdmin(req, res, next) {
  const admin = await getAdminUser(req.user.email);
  if (!admin || !admin.active) return res.status(403).json({ error: 'Not authorized as admin' });
  req.adminRole = admin.role;
  req.adminUser = admin;
  next();
}

// ── Middleware: must be superadmin ────────────────────────────
function isSuperAdmin(req, res, next) {
  if (req.adminRole !== 'superadmin') return res.status(403).json({ error: 'Superadmin only' });
  next();
}

// ── Middleware: OTP session verified ─────────────────────────
function otpVerified(req, res, next) {
  const sessionToken = req.headers['x-admin-session'];
  if (!sessionToken) return res.status(401).json({ error: 'OTP verification required' });
  const entry = otpStore.get(`session:${sessionToken}`);
  if (!entry || Date.now() > entry.expiresAt) {
    otpStore.delete(`session:${sessionToken}`);
    return res.status(401).json({ error: 'OTP session expired' });
  }
  // Attach role to request from session
  req.sessionRole = entry.role;
  next();
}

// ─────────────────────────────────────────────────────────────
// OTP ROUTES (no otpVerified needed here)
// ─────────────────────────────────────────────────────────────

// POST /api/admin/send-otp
router.post('/send-otp', authenticate, isAdmin, async (req, res) => {
  try {
    const email = req.user.email;

    // Rate limit
    const key      = `otp:${email}`;
    const existing = otpStore.get(key);
    if (existing && existing.requestCount >= 3 && Date.now() < existing.windowEnd) {
      return res.status(429).json({ error: 'Too many OTP requests. Wait 5 minutes.' });
    }

    const otp       = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 min
    otpStore.set(key, {
      otp, expiresAt, attempts: 0,
      role:         req.adminRole,
      requestCount: (existing?.requestCount || 0) + 1,
      windowEnd:    existing?.windowEnd || (Date.now() + 5 * 60 * 1000),
    });

    // ── Respond IMMEDIATELY — don't block on email ──────────────
    // OTP is already saved in memory, respond now so UI doesn't hang
    console.log(`🔐 Admin OTP for ${email}: ${otp}  (role: ${req.adminRole})`);
    res.json({ success: true, message: `OTP sent to ${email}` });

    // ── Send email in background (non-blocking) ───────────────
    if (process.env.GMAIL_APP_PASSWORD) {
      setImmediate(async () => {
        try {
          const mailer = getMailer();
          await mailer.sendMail({
            from:    `"rk.ai Admin" <${process.env.ADMIN_EMAIL}>`,
            to:      email,
            subject: `🔐 rk.ai Admin OTP: ${otp}`,
            html: `
              <div style="font-family:system-ui,sans-serif;max-width:420px;margin:0 auto;padding:32px;background:#0f172a;border-radius:12px;">
                <h2 style="color:#f1f5f9;margin:0 0 6px">rk.ai Admin Login</h2>
                <p style="color:#94a3b8;margin:0 0 6px">Role: <strong style="color:#c96442">${req.adminRole.toUpperCase()}</strong></p>
                <div style="background:#1e293b;border-radius:8px;padding:24px;text-align:center;margin-bottom:20px;">
                  <p style="color:#64748b;font-size:12px;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.1em">Your OTP</p>
                  <p style="color:#c96442;font-size:48px;font-weight:900;letter-spacing:0.25em;margin:0">${otp}</p>
                  <p style="color:#64748b;font-size:12px;margin:8px 0 0">Expires in 10 minutes</p>
                </div>
                <p style="color:#475569;font-size:12px">If you didn't request this, ignore this email.</p>
              </div>`,
          });
          console.log(`✅ OTP email delivered to ${email}`);
        } catch (mailErr) {
          // Email failed but OTP still works — user can check Render logs
          console.log(`⚠️ OTP email failed: ${mailErr.message}`);
          console.log(`🔐 OTP (check logs): ${otp}`);
        }
      });
    } else {
      console.log(`⚠️ GMAIL_APP_PASSWORD not set — OTP only in logs above`);
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/verify-otp
router.post('/verify-otp', authenticate, isAdmin, async (req, res) => {
  try {
    const email  = req.user.email;
    const { otp } = req.body;
    const key    = `otp:${email}`;
    const entry  = otpStore.get(key);

    if (!entry)                       return res.status(400).json({ error: 'No OTP found — request a new one' });
    if (Date.now() > entry.expiresAt) { otpStore.delete(key); return res.status(400).json({ error: 'OTP expired' }); }
    if (entry.attempts >= 5)          return res.status(429).json({ error: 'Too many attempts — request new OTP' });
    if (entry.otp !== otp.trim()) {
      entry.attempts++;
      return res.status(400).json({ error: `Wrong OTP. ${5 - entry.attempts} attempts left.` });
    }

    // ✅ Create 2-hour session
    const sessionToken  = Math.random().toString(36).slice(2) + Date.now().toString(36);
    otpStore.set(`session:${sessionToken}`, {
      email, role: entry.role,
      expiresAt: Date.now() + 2 * 60 * 60 * 1000,
    });
    otpStore.delete(key);

    console.log(`✅ Admin session created for ${email} (${entry.role})`);
    res.json({ success: true, sessionToken, role: entry.role });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/admin/check — check if email is an admin (before OTP)
router.get('/check', authenticate, async (req, res) => {
  const admin = await getAdminUser(req.user.email);
  if (!admin || !admin.active) return res.json({ isAdmin: false });
  res.json({ isAdmin: true, role: admin.role, name: admin.name });
});

// ─────────────────────────────────────────────────────────────
// DASHBOARD DATA ROUTES (require JWT + OTP session)
// ─────────────────────────────────────────────────────────────

// GET /api/admin/summary
router.get('/summary', authenticate, isAdmin, otpVerified, async (req, res) => {
  try {
    const summary = await getBusinessSummary();
    res.json({ ...summary, viewerRole: req.adminRole });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/users
router.get('/users', authenticate, isAdmin, otpVerified, async (req, res) => {
  try {
    let users = await getAllUserStats();
    // Viewer role: mask emails for privacy
    if (req.adminRole === 'viewer') {
      users = users.map(u => ({
        ...u,
        email: u.email.replace(/(.{2}).*(@.*)/, '$1***$2'),
        name:  u.name,
      }));
    }
    res.json(users);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/user/:id/logs
router.get('/user/:id/logs', authenticate, isAdmin, otpVerified, async (req, res) => {
  try {
    if (req.adminRole === 'viewer') return res.status(403).json({ error: 'Viewer cannot see individual logs' });
    const logs = await prisma.apiUsageLog.findMany({
      where: { userId: req.params.id }, orderBy: { createdAt: 'desc' }, take: 50,
    });
    res.json(logs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// ADMIN USER MANAGEMENT (superadmin only)
// ─────────────────────────────────────────────────────────────

// GET /api/admin/admins — list all admin users
router.get('/admins', authenticate, isAdmin, otpVerified, isSuperAdmin, async (req, res) => {
  try {
    const admins = await prisma.adminUser.findMany({ orderBy: { createdAt: 'asc' } });
    res.json(admins);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/admins — add a new admin
router.post('/admins', authenticate, isAdmin, otpVerified, isSuperAdmin, async (req, res) => {
  try {
    const { email, name, role } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    if (!['admin','viewer'].includes(role)) return res.status(400).json({ error: 'Role must be admin or viewer' });
    // Cannot add another superadmin
    if (role === 'superadmin') return res.status(400).json({ error: 'Cannot create another superadmin' });

    const existing = await prisma.adminUser.findUnique({ where: { email } });
    if (existing) {
      // Reactivate if previously removed
      const updated = await prisma.adminUser.update({ where: { email }, data: { active: true, role, name: name || existing.name } });
      return res.json({ success: true, admin: updated, message: 'Admin reactivated' });
    }

    const admin = await prisma.adminUser.create({
      data: { email, name: name || email.split('@')[0], role, addedBy: req.user.email, active: true },
    });
    console.log(`👤 New admin added: ${email} (${role}) by ${req.user.email}`);
    res.json({ success: true, admin });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/admin/admins/:id — update role
router.patch('/admins/:id', authenticate, isAdmin, otpVerified, isSuperAdmin, async (req, res) => {
  try {
    const { role, active } = req.body;
    const admin = await prisma.adminUser.findUnique({ where: { id: req.params.id } });
    if (!admin) return res.status(404).json({ error: 'Admin not found' });
    if (admin.role === 'superadmin') return res.status(403).json({ error: 'Cannot modify superadmin' });
    const updated = await prisma.adminUser.update({
      where: { id: req.params.id },
      data:  { ...(role ? { role } : {}), ...(active !== undefined ? { active } : {}) },
    });
    res.json({ success: true, admin: updated });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/admin/admins/:id — remove admin (soft delete)
router.delete('/admins/:id', authenticate, isAdmin, otpVerified, isSuperAdmin, async (req, res) => {
  try {
    const admin = await prisma.adminUser.findUnique({ where: { id: req.params.id } });
    if (!admin) return res.status(404).json({ error: 'Admin not found' });
    if (admin.role === 'superadmin') return res.status(403).json({ error: 'Cannot remove superadmin' });
    await prisma.adminUser.update({ where: { id: req.params.id }, data: { active: false } });
    console.log(`🗑️ Admin removed: ${admin.email} by ${req.user.email}`);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;