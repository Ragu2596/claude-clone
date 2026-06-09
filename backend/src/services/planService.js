// backend/src/services/planService.js
// All plan, rate-limit, trial, and model-access DB operations.
// No HTTP/Express in here — pure business logic.

import prisma from '../lib/prisma.js';
import { RATE_LIMITS, MODEL_DAILY_LIMITS, STATIC_MODELS, EXCLUDED_MODELS, TRIAL_LIMIT, FREE_FALLBACK_MODEL, planAllowsModel } from '../models/plan.js';

// ─── Active plan (auto-downgrade if expired) ──────────────────────────────────
export async function getActivePlan(userId) {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { plan: true, planExpiresAt: true },
  });
  if (!user) return 'free';

  if (user.plan !== 'free' && user.planExpiresAt && user.planExpiresAt < new Date()) {
    await prisma.user.update({ where: { id: userId }, data: { plan: 'free' } });
    console.log(`⏰ Plan expired: ${userId} → free`);
    return 'free';
  }
  return user.plan || 'free';
}

// ─── Select model — DB first, static fallback ────────────────────────────────
export async function selectModel(requested) {
  if (requested === 'auto') return STATIC_MODELS['auto'];

  try {
    const m = await prisma.modelConfig.findFirst({
      where: { modelId: requested, enabled: true, NOT: { modelId: { in: [...EXCLUDED_MODELS] } } },
    });
    if (m) return { provider: m.provider, id: m.modelId, requiredPlan: m.requiredPlan, free: !m.requiredPlan };
  } catch {}

  return STATIC_MODELS[requested] || STATIC_MODELS['auto'];
}

// ─── Rate limit check — 3 rolling windows ────────────────────────────────────
async function countMsgsInWindow(userId, sinceDate) {
  return prisma.message.count({
    where: { role: 'user', conversation: { userId }, createdAt: { gte: sinceDate } },
  });
}

async function nextAvailableAt(userId, windowMs, limit) {
  const since = new Date(Date.now() - windowMs);
  const msgs  = await prisma.message.findMany({
    where:   { role: 'user', conversation: { userId }, createdAt: { gte: since } },
    orderBy: { createdAt: 'asc' },
    take:    limit,
    select:  { createdAt: true },
  });
  if (msgs.length < limit) return null;
  return new Date(msgs[0].createdAt.getTime() + windowMs);
}

export async function checkRateLimit(userId, userPlan, modelFree = false) {
  if (modelFree) return { exceeded: false };

  const limits = RATE_LIMITS[userPlan] || RATE_LIMITS.free;
  const now    = Date.now();

  const [fiveHourCount, dayCount, weekCount] = await Promise.all([
    countMsgsInWindow(userId, new Date(now - 5 * 60 * 60 * 1000)),
    countMsgsInWindow(userId, new Date(now - 24 * 60 * 60 * 1000)),
    countMsgsInWindow(userId, new Date(now - 7 * 24 * 60 * 60 * 1000)),
  ]);

  if (fiveHourCount >= limits.fiveHour) {
    return { exceeded: true, window: 'fiveHour', count: fiveHourCount, limit: limits.fiveHour, retryAt: await nextAvailableAt(userId, 5 * 3600000, limits.fiveHour), dayCount, dayLimit: limits.daily, weekCount, weekLimit: limits.weekly, plan: userPlan };
  }
  if (dayCount >= limits.daily) {
    return { exceeded: true, window: 'daily', count: dayCount, limit: limits.daily, retryAt: await nextAvailableAt(userId, 86400000, limits.daily), dayCount, dayLimit: limits.daily, weekCount, weekLimit: limits.weekly, plan: userPlan };
  }
  if (weekCount >= limits.weekly) {
    return { exceeded: true, window: 'weekly', count: weekCount, limit: limits.weekly, retryAt: await nextAvailableAt(userId, 7 * 86400000, limits.weekly), dayCount, dayLimit: limits.daily, weekCount, weekLimit: limits.weekly, plan: userPlan };
  }

  return { exceeded: false, fiveHourCount, fiveHourLimit: limits.fiveHour, dayCount, dayLimit: limits.daily, weekCount, weekLimit: limits.weekly, plan: userPlan };
}

// ─── Per-model daily cap ──────────────────────────────────────────────────────
export async function checkModelDailyLimit(userId, modelId, userPlan) {
  const limits = MODEL_DAILY_LIMITS[modelId];
  if (!limits) return { exceeded: false };

  const planLimit = limits[userPlan] ?? 0;
  if (planLimit === 999) return { exceeded: false };

  const count = await prisma.message.count({
    where: { role: 'user', modelUsed: modelId, conversation: { userId }, createdAt: { gte: new Date(Date.now() - 86400000) } },
  });

  if (count >= planLimit) {
    return { exceeded: true, modelId, count, limit: planLimit, retryAt: new Date(Date.now() + 86400000) };
  }
  return { exceeded: false, count, limit: planLimit };
}

// ─── Trial system ─────────────────────────────────────────────────────────────
export async function getTrialStatus(userId, modelId) {
  const trial = await prisma.modelTrial.findUnique({ where: { userId_modelId: { userId, modelId } } });
  const used  = trial?.useCount || 0;
  return { used, remaining: Math.max(0, TRIAL_LIMIT - used), exhausted: used >= TRIAL_LIMIT };
}

export async function incrementTrial(userId, modelId) {
  await prisma.modelTrial.upsert({
    where:  { userId_modelId: { userId, modelId } },
    update: { useCount: { increment: 1 } },
    create: { userId, modelId, useCount: 1, exhausted: false },
  });
  const trial = await prisma.modelTrial.findUnique({ where: { userId_modelId: { userId, modelId } } });
  if (trial && trial.useCount >= TRIAL_LIMIT) {
    await prisma.modelTrial.update({ where: { userId_modelId: { userId, modelId } }, data: { exhausted: true } });
  }
}

// ─── Resolve model with all plan checks ──────────────────────────────────────
// Returns { chosenModel, trialInfo, error }
export async function resolveModel(requestedModel, userId, userPlan, hasFile) {
  // File upload check
  if (hasFile && userPlan === 'free') {
    return { error: { status: 403, body: { error: 'File uploads require Starter plan.', upgradeRequired: true, plan: userPlan } } };
  }

  let chosenModel = await selectModel(requestedModel);

  // Plan access
  if (!planAllowsModel(chosenModel, userPlan)) {
    console.log(`🔒 ${chosenModel.id} requires ${chosenModel.requiredPlan}, user has ${userPlan} — fallback`);
    chosenModel = STATIC_MODELS['auto'];
  }

  // Trial check for free users
  let trialInfo = null;
  if (userPlan === 'free' && chosenModel.requiredPlan) {
    const trial = await getTrialStatus(userId, chosenModel.id);
    if (trial.exhausted) {
      return { error: { status: 403, body: { error: 'Trial exhausted. Upgrade to continue!', trialExhausted: true, modelId: chosenModel.id, plan: userPlan } } };
    }
    trialInfo = trial;
  }

  return { chosenModel, trialInfo };
}
