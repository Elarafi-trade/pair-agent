import 'dotenv/config';
import http from 'http';
import { URL } from 'url';

// Start the trading agent loop by importing the main orchestrator
import './index.js';

// DB helpers
import { initializeTables, getAllTrades, getPerformanceMetrics } from './db.js';

// Analysis helpers
import { fetchPairData, withRetry } from './fetcher.js';
import { analyzePair, meetsTradeSignalCriteria } from './pair_analysis.js';
import { generateNarrative } from './narrative.js';

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

    if (req.method === 'POST' && path === '/api/analyze') {
      // Parse request body
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });

      await new Promise<void>((resolve) => {
        req.on('end', resolve);
      });

      try {
        const data = JSON.parse(body);
        const { symbolA, symbolB, limit } = data;

        if (!symbolA || !symbolB) {
          return writeJson(res, 400, { 
            error: 'Missing required fields: symbolA and symbolB are required',
            example: { symbolA: 'SOL-PERP', symbolB: 'ETH-PERP', limit: 100 }
          });
        }

        // Fetch pair data
        const { dataA, dataB } = await withRetry(
          () => fetchPairData(0, 0, symbolA, symbolB, limit || 100),
          3,
          1000
        );

        // Analyze the pair
        const analysis = analyzePair(dataA.prices, dataB.prices);

        // Generate narrative
        const narrative = generateNarrative(symbolA, symbolB, analysis);

        // Check if meets trade criteria
        const meetsSignal = meetsTradeSignalCriteria(analysis, 2.0, 0.8);

        // Build response
        const response = {
          pair: `${symbolA}/${symbolB}`,
          symbolA,
          symbolB,
          dataPoints: dataA.prices.length,
          analysis: {
            correlation: Number(analysis.corr.toFixed(4)),
            beta: Number(analysis.beta.toFixed(4)),
            zScore: Number(analysis.zScore.toFixed(2)),
            spreadMean: Number(analysis.mean.toFixed(4)),
            spreadStd: Number(analysis.std.toFixed(4)),
            currentSpread: Number(analysis.spread.toFixed(4)),
            signalType: analysis.signalType,
          },
          signal: {
            meetsThreshold: meetsSignal,
            action: meetsSignal ? (analysis.zScore > 0 ? `SHORT ${symbolA}, LONG ${symbolB}` : `LONG ${symbolA}, SHORT ${symbolB}`) : 'NEUTRAL',
            recommendation: meetsSignal ? (analysis.zScore > 0 ? 'short' : 'long') : 'neutral',
          },
          narrative,
          timestamp: new Date().toISOString(),
        };

        return writeJson(res, 200, response);
      } catch (err: any) {
        console.error('[API] Analysis error:', err);
        return writeJson(res, 500, { 
          error: 'Analysis failed', 
          message: err.message 
        });
      }
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
  console.log(`[WEB] API:    POST /api/analyze (body: {symbolA, symbolB, limit?})`);
});
