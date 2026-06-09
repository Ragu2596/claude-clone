// frontend/src/services/sse.js
// Parses SSE streams. Returns an async generator of parsed events.
// useChat.js consumes this — no raw fetch/ReadableStream there.

export async function* parseSSEStream(response) {
  const reader  = response.body.getReader();
  const decoder = new TextDecoder();
  let   buffer  = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE messages are separated by double newline
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';

    for (const block of blocks) {
      const lines = block.split('\n');
      let eventType = 'message';
      let data      = '';

      for (const line of lines) {
        if (line.startsWith('event: ')) eventType = line.slice(7).trim();
        if (line.startsWith('data: '))  data      = line.slice(6).trim();
      }

      if (!data) continue;

      let parsed;
      try { parsed = JSON.parse(data); } catch { continue; }

      yield { type: eventType, data: parsed };
    }
  }
}
