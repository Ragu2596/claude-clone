import express from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { authenticate } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import dotenv from 'dotenv';
dotenv.config();

const router = express.Router();

// ── Init Razorpay once (not per-request) ─────────────────────
const getRazorpay = () => {
  const key_id     = process.env.RAZORPAY_KEY_ID?.trim();
  const key_secret = process.env.RAZORPAY_KEY_SECRET?.trim();

  if (!key_id || !key_secret) {
    throw new Error(`Razorpay env missing — KEY_ID: ${!!key_id}, SECRET: ${!!key_secret}`);
  }
  return new Razorpay({ key_id, key_secret });
};

// ── POST /payments/create-order ──────────────────────────────
router.post('/create-order', authenticate, async (req, res) => {
  const { plan, billing } = req.body;

  const prices = {
    pro_monthly:  99900,
    pro_yearly:   82900,
    max_monthly:  299900,
    max_yearly:   248900,
  };

  const key = `${plan}_${billing || 'monthly'}`;
  const amount = prices[key];

  if (!plan || !amount) {
    return res.status(400).json({ error: `Invalid plan/billing: ${key}` });
  }

  try {
    const razorpay = getRazorpay();

    const order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt:  `rkai_${req.user.id}_${Date.now()}`.slice(0, 40),
      notes:    { userId: req.user.id, plan, email: req.user.email },
    });

    console.log(`💳 Order created: ${order.id} | ${req.user.email} | ${plan}`);

    res.json({
      orderId:  order.id,
      amount:   order.amount,
      currency: order.currency,
      key:      process.env.RAZORPAY_KEY_ID?.trim(),
    });

  } catch (e) {
    // ✅ Properly log Razorpay errors (they are NOT plain Error objects)
    console.error('❌ Order error:', {
      message:     e.message,
      statusCode:  e.statusCode,
      error:       e.error,          // Razorpay puts details here
      description: e.error?.description,
    });

    res.status(500).json({
      error:       'Failed to create order',
      // Remove the line below in production if you don't want to expose details
      detail:      e.error?.description || e.message,
    });
  }
});

// ── POST /payments/verify ────────────────────────────────────
router.post('/verify', authenticate, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing payment details' });
  }

  try {
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET?.trim())
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expected !== razorpay_signature) {
      console.error('❌ Invalid signature:', req.user.email);
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    await prisma.user.update({
      where: { id: req.user.id },
      data:  { plan, planExpiresAt: expiresAt, planPaymentId: razorpay_payment_id },
    });

    await prisma.payment.create({
      data: {
        userId:    req.user.id,
        orderId:   razorpay_order_id,
        paymentId: razorpay_payment_id,
        plan,
        billing:   'monthly',
        amount:    plan === 'pro' ? 99900 : 299900,
        status:    'paid',
      },
    });

    console.log(`✅ Payment verified: ${req.user.email} → ${plan}`);
    res.json({ success: true, plan, expiresAt });

  } catch (e) {
    console.error('❌ Verify error:', e.message);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ── GET /payments/status ─────────────────────────────────────
router.get('/status', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where:  { id: req.user.id },
      select: { plan: true, planExpiresAt: true },
    });
    const active = user.plan !== 'free' && user.planExpiresAt > new Date();
    res.json({ plan: active ? user.plan : 'free', expiresAt: user.planExpiresAt });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;