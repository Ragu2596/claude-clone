// backend/src/providers/index.js
// All AI provider streaming functions.
// Each provider function: takes (model, systemPrompt, history, res) → returns fullText string.
// chat.js calls callProvider() — it never knows which provider is used.

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/index.js';
import { send } from '../lib/sse.js';

const anthropic = new Anthropic({ apiKey: config.anthropicKey });

// Reasoning models need max_completion_tokens, not max_tokens
const REASONING_MODELS = new Set(['o3', 'o4-mini', 'o1', 'o1-mini']);

// ─── OpenAI-compatible streaming (Groq, Mistral, Together, Perplexity, OpenAI) ──
async function streamOpenAICompatible({ apiKey, baseURL, model, systemPrompt, history, res }) {
  if (!apiKey) throw new Error(`API key missing for ${baseURL}`);

  const messages = [{ role: 'system', content: systemPrompt }, ...history];
  const isReasoning = REASONING_MODELS.has(model);

  const body = isReasoning
    ? { model, messages, max_completion_tokens: 8192, stream: true }
    : { model, messages, max_tokens: 4096, stream: true };

  const response = await fetch(`${baseURL}/chat/completions`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`${baseURL} error ${response.status}: ${err.slice(0, 200)}`);
  }

  let fullText = '';
  const reader  = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of decoder.decode(value).split('\n').filter(l => l.startsWith('data: '))) {
      const raw = line.slice(6);
      if (raw === '[DONE]') continue;
      try {
        const text = JSON.parse(raw).choices?.[0]?.delta?.content || '';
        if (text) { fullText += text; send(res, { type: 'text', text }); }
      } catch {}
    }
  }
  return fullText;
}

// ─── Gemini ───────────────────────────────────────────────────────────────────
async function streamGemini(model, systemPrompt, history, res) {
  if (!config.geminiKey) throw new Error('GEMINI_API_KEY not set');

  const contents = history.map(m => ({
    role:  m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${config.geminiKey}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { maxOutputTokens: 4096 },
      }),
    }
  );

  if (!response.ok) throw new Error(`Gemini error ${response.status}`);

  let fullText = '';
  const reader  = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of decoder.decode(value).split('\n').filter(l => l.startsWith('data: '))) {
      try {
        const text = JSON.parse(line.slice(6)).candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (text) { fullText += text; send(res, { type: 'text', text }); }
      } catch {}
    }
  }
  return fullText;
}

// ─── Anthropic ────────────────────────────────────────────────────────────────
// enableThinking: auto-enabled for claude-opus-4-6 on long messages (>100 chars)
async function streamAnthropic(model, systemPrompt, history, res, enableThinking = false) {
  let fullText = '';

  const params = {
    model,
    max_tokens: enableThinking ? 16000 : 4096,
    system:     systemPrompt,
    messages:   history,
  };

  if (enableThinking && model === 'claude-opus-4-6') {
    params.thinking = { type: 'enabled', budget_tokens: 10000 };
  }

  const stream = anthropic.messages.stream(params);

  if (enableThinking) {
    stream.on('streamEvent', (event) => {
      if (event.type === 'content_block_start' && event.content_block?.type === 'thinking') {
        send(res, { type: 'thinking_start' });
      }
    });
  }

  stream.on('text', text => {
    fullText += text;
    send(res, { type: 'text', text });
  });

  await stream.finalMessage();
  return fullText;
}

// ─── Fallback chain ───────────────────────────────────────────────────────────
async function streamGroqFallback(systemPrompt, history, res) {
  try {
    return await streamOpenAICompatible({
      apiKey: config.groqKey, baseURL: 'https://api.groq.com/openai/v1',
      model: 'llama-3.3-70b-versatile', systemPrompt, history, res,
    });
  } catch {
    return await streamOpenAICompatible({
      apiKey: config.groqKey, baseURL: 'https://api.groq.com/openai/v1',
      model: 'llama-3.1-8b-instant', systemPrompt, history, res,
    });
  }
}

// ─── Main router — called by chat.js ─────────────────────────────────────────
export async function callProvider(chosenModel, systemPrompt, history, res, enableThinking = false) {
  const { provider, id } = chosenModel;

  try {
    switch (provider) {
      case 'groq':       return await streamOpenAICompatible({ apiKey: config.groqKey,       baseURL: 'https://api.groq.com/openai/v1',  model: id, systemPrompt, history, res });
      case 'mistral':    return await streamOpenAICompatible({ apiKey: config.mistralKey,    baseURL: 'https://api.mistral.ai/v1',        model: id, systemPrompt, history, res });
      case 'together':   return await streamOpenAICompatible({ apiKey: config.togetherKey,   baseURL: 'https://api.together.xyz/v1',      model: id, systemPrompt, history, res });
      case 'perplexity': return await streamOpenAICompatible({ apiKey: config.perplexityKey, baseURL: 'https://api.perplexity.ai',        model: id, systemPrompt, history, res });
      case 'openai':     return await streamOpenAICompatible({ apiKey: config.openaiKey,     baseURL: 'https://api.openai.com/v1',        model: id, systemPrompt, history, res });
      case 'gemini':     return await streamGemini(id, systemPrompt, history, res);
      case 'anthropic':  return await streamAnthropic(id, systemPrompt, history, res, enableThinking);
      default:           throw new Error(`Unknown provider: ${provider}`);
    }
  } catch (err) {
    console.error(`❌ ${provider} failed: ${err.message} — falling back to Groq`);
    return await streamGroqFallback(systemPrompt, history, res);
  }
}