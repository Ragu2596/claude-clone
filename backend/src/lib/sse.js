// backend/src/lib/sse.js
// Server-Sent Events helpers for backend routes.

import { config } from '../config/index.js';

// Write one SSE data frame to the response
export function send(res, data) {
  res.write('data: ' + JSON.stringify(data) + '\n\n');
  if (res.flush) res.flush();
}

// Set all required SSE headers and call writeHead
export function startSSE(res) {
  res.writeHead(200, {
    'Content-Type':                     'text/event-stream',
    'Cache-Control':                    'no-cache, no-transform',
    'Connection':                       'keep-alive',
    'X-Accel-Buffering':                'no',
    'Access-Control-Allow-Origin':      config.frontendUrl,
    'Access-Control-Allow-Credentials': 'true',
  });
}