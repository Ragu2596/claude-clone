import express from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { authenticate } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { activatePlanBudget } from '../services/costService.js';
import { config } from '../config/index.js';

const router = express.Router();

// ── Init Razorpay ─────────────────────────────────────────────
const getRazorpay = () => {
  const key_id     = config.razorpayKeyId;
  const key_secret = config.razorpayKeySecret;
  if (!key_id || !key_secret) {
    throw new Error(`Razorpay env missing — KEY_ID: ${!!key_id}, SECRET: ${!!key_secret}`);
  }
  return new Razorpay({ key_id, key_secret });
};

// ── Plan prices in INR paise (1 INR = 100 paise) ──────────────
const PRICES = {
  starter_monthly:  19900,
  starter_yearly:   159000,
  pro_monthly:      49900,
  pro_yearly:       399000,
  max_monthly:      99900,
  max_yearly:       799000,
};

const EXPIRY_DAYS = { monthly: 30, yearly: 365 };

// ── POST /payments/create-order ───────────────────────────────
router.post('/create-order', authenticate, async (req, res) => {
  const { plan, billing } = req.body;

  if (!plan || !billing)
    return res.status(400).json({ error: 'plan and billing are required' });
  if (!['starter', 'pro', 'max'].includes(plan))
    return res.status(400).json({ error: `Invalid plan: ${plan}` });
  if (!['monthly', 'yearly'].includes(billing))
    return res.status(400).json({ error: `Invalid billing: ${billing}` });

  const amount = PRICES[`${plan}_${billing}`];
  if (!amount) return res.status(400).json({ error: `No price found for ${plan}_${billing}` });

  try {
    const razorpay = getRazorpay();
    const order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt:  `rkai_${req.user.id.slice(0, 10)}_${Date.now()}`.slice(0, 40),
      notes:    { userId: req.user.id, plan, billing, email: req.user.email },
    });

    console.log(`💳 Order: ${order.id} | ${req.user.email} | ${plan}/${billing} | ₹${amount / 100}`);
    res.json({ orderId: order.id, amount: order.amount, currency: order.currency, key: config.razorpayKeyId });
  } catch (e) {
    console.error('❌ Order error:', e.message);
    res.status(500).json({ error: 'Failed to create order', detail: e.error?.description || e.message });
  }
});

// ── POST /payments/verify ─────────────────────────────────────
router.post('/verify', authenticate, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan, billing } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
    return res.status(400).json({ error: 'Missing payment details' });

  try {
    const expected = crypto
      .createHmac('sha256', config.razorpayKeySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expected !== razorpay_signature) {
      console.error('❌ Invalid signature:', req.user.email);
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    const days      = EXPIRY_DAYS[billing] || 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    await prisma.user.update({
      where: { id: req.user.id },
      data:  { plan, billing, planExpiresAt: expiresAt, planPaymentId: razorpay_payment_id },
    });

    const amount = Math.round((PRICES[`${plan}_${billing || 'monthly'}`] || 0) / 100);
    await prisma.payment.create({
      data: { userId: req.user.id, orderId: razorpay_order_id, paymentId: razorpay_payment_id, plan, billing: billing || 'monthly', amount, status: 'paid', updatedAt: new Date() },
    });

    await activatePlanBudget(req.user.id, plan, billing);

    console.log(`✅ Verified: ${req.user.email} → ${plan}/${billing} expires ${expiresAt.toDateString()}`);
    res.json({ success: true, plan, expiresAt });
  } catch (e) {
    console.error('❌ Verify error:', e.message);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ── GET /payments/status ──────────────────────────────────────
router.get('/status', authenticate, async (req, res) => {
  try {
    const user   = await prisma.user.findUnique({ where: { id: req.user.id }, select: { plan: true, planExpiresAt: true } });
    const active = user.plan !== 'free' && user.planExpiresAt > new Date();
    res.json({ plan: active ? user.plan : 'free', expiresAt: user.planExpiresAt });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /payments/history ─────────────────────────────────────
router.get('/history', authenticate, async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 20 });
    res.json(payments);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /payments/my-billing ──────────────────────────────────
router.get('/my-billing', authenticate, async (req, res) => {
  try {
    const last = await prisma.payment.findFirst({ where: { userId: req.user.id, status: 'paid' }, orderBy: { createdAt: 'desc' }, select: { billing: true, plan: true } });
    res.json({ billing: last?.billing || 'monthly', plan: last?.plan || req.user.plan || 'free' });
  } catch (e) {
    res.json({ billing: 'monthly' });
  }
});

export default router;