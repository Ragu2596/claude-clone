import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Extract key facts from conversation and save to UserMemory
export async function updateUserMemory(userId, userMessage, aiResponse) {
  try {
    // Get existing memory
    const existing = await prisma.userMemory.findUnique({ where: { userId } });
    const currentMemory = existing?.memory || '';

    // Use Groq (free & fast) to extract key facts
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return;

    const prompt = `You are a memory extractor. Extract ONLY important technical facts worth remembering long-term from this conversation exchange.

EXISTING MEMORY:
${currentMemory || 'None yet'}

NEW EXCHANGE:
User: ${userMessage.slice(0, 500)}
AI: ${aiResponse.slice(0, 500)}

Rules:
- Extract facts like: project names, tech stack, goals, preferences, problems solved
- Skip generic questions, greetings, or one-off questions
- Merge with existing memory, remove duplicates
- Keep it SHORT — max 20 bullet points total
- Format: bullet points starting with "-"
- If nothing important, return existing memory unchanged
- Return ONLY the bullet points, no other text

Updated memory:`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.1,
      }),
    });

    if (!response.ok) return;
    const data = await response.json();
    const newMemory = data.choices?.[0]?.message?.content?.trim();
    if (!newMemory || newMemory.length < 10) return;

    // Save to DB (upsert)
    await prisma.userMemory.upsert({
      where: { userId },
      update: { memory: newMemory, updatedAt: new Date() },
      create: { userId, memory: newMemory },
    });

    console.log(`🧠 Memory updated for user ${userId}`);
  } catch (e) {
    console.error('Memory update failed (non-critical):', e.message);
    // Never crash the main chat flow
  }
}

// Get user memory to inject into system prompt
export async function getUserMemory(userId) {
  try {
    const mem = await prisma.userMemory.findUnique({ where: { userId } });
    return mem?.memory || null;
  } catch {
    return null;
  }
}
