import 'dotenv/config';
import http from 'http';
import { URL } from 'url';

// Start the trading agent loop by importing the main orchestrator
import './index.js';

// DB helpers
import { initializeTables, getAllTrades, getPerformanceMetrics } from './db.js';

const PORT = Number(process.env.PORT || 3000);

function writeJson(res: http.ServerResponse, status: number, body: unknown) {
  const text = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Length', Buffer.byteLength(text));
  res.end(text);
}

function setCors(res: http.ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

const server = http.createServer(async (req, res) => {
  try {
    setCors(res);

    if (!req.url || !req.method) {
      return writeJson(res, 400, { error: 'Bad request' });
    }

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      return res.end();
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);
    const path = url.pathname;

    if (req.method === 'GET' && path === '/health') {
      return writeJson(res, 200, { status: 'ok', time: new Date().toISOString() });
    }

    if (req.method === 'GET' && path === '/api/trades') {
      await initializeTables();
      const trades = await getAllTrades();
      return writeJson(res, 200, trades);
    }

    if (req.method === 'GET' && path === '/api/performance') {
      await initializeTables();
      const metrics = await getPerformanceMetrics();
      return writeJson(res, 200, metrics ?? {});
    }

    writeJson(res, 404, { error: 'Not found' });
  } catch (err: any) {
    console.error('[WEB] Request error:', err);
    writeJson(res, 500, { error: 'Internal server error' });
  }
});

server.listen(PORT, () => {
  console.log(`[WEB] Render Web Service listening on port ${PORT}`);
  console.log(`[WEB] Health: GET /health`);
  console.log(`[WEB] API:    GET /api/trades, GET /api/performance`);
});
