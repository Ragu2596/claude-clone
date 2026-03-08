import express from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { authenticate } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import dotenv from 'dotenv';
dotenv.config();

const router = express.Router();

// ── Init Razorpay ─────────────────────────────────────────────
const getRazorpay = () => {
  const key_id     = process.env.RAZORPAY_KEY_ID?.trim();
  const key_secret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!key_id || !key_secret) {
    throw new Error(`Razorpay env missing — KEY_ID: ${!!key_id}, SECRET: ${!!key_secret}`);
  }
  return new Razorpay({ key_id, key_secret });
};

// ── Plan prices in INR paise (1 INR = 100 paise) ──────────────
const PRICES = {
  starter_monthly:  19900,   // ₹199
  starter_yearly:   159000,  // ₹1590
  pro_monthly:      49900,   // ₹499
  pro_yearly:       399000,  // ₹3990
  max_monthly:      99900,   // ₹999
  max_yearly:       799000,  // ₹7990
};

// ── Plan expiry days ──────────────────────────────────────────
const EXPIRY_DAYS = {
  monthly: 30,
  yearly:  365,
};

// ── POST /payments/create-order ───────────────────────────────
router.post('/create-order', authenticate, async (req, res) => {
  const { plan, billing } = req.body;

  if (!plan || !billing) {
    return res.status(400).json({ error: 'plan and billing are required' });
  }

  if (!['starter', 'pro', 'max'].includes(plan)) {
    return res.status(400).json({ error: `Invalid plan: ${plan}` });
  }

  if (!['monthly', 'yearly'].includes(billing)) {
    return res.status(400).json({ error: `Invalid billing: ${billing}` });
  }

  const priceKey = `${plan}_${billing}`;
  const amount   = PRICES[priceKey];

  if (!amount) {
    return res.status(400).json({ error: `No price found for ${priceKey}` });
  }

  try {
    const razorpay = getRazorpay();

    const order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt:  `rkai_${req.user.id.slice(0, 10)}_${Date.now()}`.slice(0, 40),
      notes:    { userId: req.user.id, plan, billing, email: req.user.email },
    });

    console.log(`💳 Order: ${order.id} | ${req.user.email} | ${plan}/${billing} | ₹${amount / 100}`);

    res.json({
      orderId:  order.id,
      amount:   order.amount,
      currency: order.currency,
      key:      process.env.RAZORPAY_KEY_ID?.trim(),
    });

  } catch (e) {
    console.error('❌ Order error:', {
      message:     e.message,
      statusCode:  e.statusCode,
      description: e.error?.description,
    });
    res.status(500).json({
      error:  'Failed to create order',
      detail: e.error?.description || e.message,
    });
  }
});

// ── POST /payments/verify ─────────────────────────────────────
router.post('/verify', authenticate, async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    plan,
    billing,
  } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing payment details' });
  }

  try {
    // ── 1. Verify signature ───────────────────────────────────
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET?.trim())
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expected !== razorpay_signature) {
      console.error('❌ Invalid signature:', req.user.email);
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    // ── 2. Calculate expiry ───────────────────────────────────
    const days      = EXPIRY_DAYS[billing] || 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    // ── 3. Update user plan ───────────────────────────────────
    await prisma.user.update({
      where: { id: req.user.id },
      data:  { plan, planExpiresAt: expiresAt, planPaymentId: razorpay_payment_id },
    });

    // ── 4. Save payment record ────────────────────────────────
    const priceKey = `${plan}_${billing || 'monthly'}`;
    const amount   = Math.round((PRICES[priceKey] || 0) / 100); // store in INR

    await prisma.payment.create({
      data: {
        userId:    req.user.id,
        orderId:   razorpay_order_id,
        paymentId: razorpay_payment_id,
        plan,
        billing:   billing || 'monthly',
        amount,
        status:    'paid',
        updatedAt: new Date(),
      },
    });

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
    const user   = await prisma.user.findUnique({
      where:  { id: req.user.id },
      select: { plan: true, planExpiresAt: true },
    });
    const active = user.plan !== 'free' && user.planExpiresAt > new Date();
    res.json({ plan: active ? user.plan : 'free', expiresAt: user.planExpiresAt });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /payments/history ─────────────────────────────────────
router.get('/history', authenticate, async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      where:   { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json(payments);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
