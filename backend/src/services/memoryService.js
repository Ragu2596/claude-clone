// backend/src/services/memoryService.js
// Per-user memory — extracts key facts from each conversation
// using Groq (free + fast) and injects them into the system prompt.

import prisma from '../lib/prisma.js';
import { config } from '../config/index.js';

export async function getUserMemory(userId) {
  try {
    const mem = await prisma.userMemory.findUnique({ where: { userId } });
    return mem?.memory || null;
  } catch {
    return null;
  }
}

export async function updateUserMemory(userId, userMessage, aiResponse) {
  try {
    if (!config.groqKey) return;

    const existing     = await prisma.userMemory.findUnique({ where: { userId } });
    const currentMemory = existing?.memory || '';

    const prompt = `You are a memory extractor. Extract ONLY important technical facts worth remembering long-term from this conversation.

EXISTING MEMORY:
${currentMemory || 'None yet'}

NEW EXCHANGE:
User: ${userMessage.slice(0, 500)}
AI: ${aiResponse.slice(0, 500)}

Rules:
- Extract facts like: project names, tech stack, goals, preferences, problems solved
- Skip generic questions, greetings, or one-off questions
- Merge with existing memory, remove duplicates
- Keep SHORT — max 20 bullet points total
- Format: bullet points starting with "-"
- If nothing important, return existing memory unchanged
- Return ONLY the bullet points, no other text

Updated memory:`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:  'POST',
      headers: { Authorization: `Bearer ${config.groqKey}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], max_tokens: 500, temperature: 0.1 }),
    });

    if (!response.ok) return;
    const data      = await response.json();
    const newMemory = data.choices?.[0]?.message?.content?.trim();
    if (!newMemory || newMemory.length < 10) return;

    await prisma.userMemory.upsert({
      where:  { userId },
      update: { memory: newMemory, updatedAt: new Date() },
      create: { userId, memory: newMemory },
    });

    console.log(`🧠 Memory updated: ${userId}`);
  } catch (e) {
    console.error('Memory update failed (non-critical):', e.message);
  }
}

export function buildSystemPrompt(basePrompt, userMemory, langInstruction) {
  let prompt = basePrompt;
  if (userMemory) {
    prompt += `\n\n--- What I know about this user from past conversations ---\n${userMemory}\n---`;
  }
  if (langInstruction) {
    prompt += `\n\n${langInstruction}`;
  }
  return prompt;
}
