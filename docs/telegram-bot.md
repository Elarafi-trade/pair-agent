# Telegram Bot for PairAgent

This guide shows how to build a lightweight Telegram bot that fetches your agent's trades (signals) and performance from the PairAgent Web API.

It uses:
- Telegram Bot API via Telegraf
- PairAgent's REST endpoints exposed by the web service
- Node.js (ES modules) with minimal dependencies

The bot supports:
- /trades — list open trades and recent closed trades
- /performance — summarize performance metrics
- /analyze SYMBOL_A SYMBOL_B [limit] — trigger an on-demand analysis via the agent and return a brief summary

---

## Prerequisites

- Node.js 18+ and npm
- A running PairAgent web service (default: https://pair-agent.onrender.com)
  - Health: GET /health
  - Endpoints: GET /api/trades, GET /api/performance, POST /api/analyze
- A Telegram account

---

## 1) Create your Telegram bot

1. In Telegram, search for `@BotFather` and start a chat.
2. Send `/newbot` and follow prompts:
   - Choose a name (e.g., "PairAgent Bot").
   - Choose a username ending with `bot` (e.g., `pair_agent_helper_bot`).
3. Copy the bot token you receive — looks like `123456789:AA...`.

Optional but recommended: decide which chats are allowed to use the bot and capture their chat IDs (for access control). The simplest way is to run the bot once and log `ctx.chat.id` when users send `/start`, or use `@userinfobot` to get your user ID.

---

## 2) Prepare a small project folder

From your PairAgent repository root on Windows PowerShell:

```powershell
mkdir docs\samples\telegram-bot; cd docs\samples\telegram-bot
npm init -y
npm install telegraf axios dotenv
```

Create a `.env` file:

```ini
# Telegram
TELEGRAM_BOT_TOKEN=YOUR_BOTFATHER_TOKEN
# Optional: restrict usage; comma-separated numeric IDs
ALLOWED_CHAT_IDS=123456789,987654321

# PairAgent API
AGENT_API_BASE=https://pair-agent.onrender.com
```

---

## 3) Create the bot script (ESM, no build step)

Create `bot.mjs` with the following code:

```js
import 'dotenv/config';
import axios from 'axios';
import { Telegraf } from 'telegraf';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) throw new Error('Missing TELEGRAM_BOT_TOKEN');

const BASE = process.env.AGENT_API_BASE || 'https://pair-agent.onrender.com';
const allowedIds = (process.env.ALLOWED_CHAT_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => Number(s))
  .filter((n) => Number.isFinite(n));

const bot = new Telegraf(TOKEN);

function isAllowed(ctx) {
  if (allowedIds.length === 0) return true; // open access if none specified
  const chatId = ctx.chat?.id;
  return typeof chatId === 'number' && allowedIds.includes(chatId);
}

function guard(handler) {
  return async (ctx) => {
    if (!isAllowed(ctx)) {
      return ctx.reply('Access denied.');
    }
    try {
      await handler(ctx);
    } catch (err) {
      console.error('[BOT] Handler error:', err);
      await ctx.reply('Sorry, something went wrong.');
    }
  };
}

async function fetchTrades() {
  const url = `${BASE}/api/trades`;
  const { data } = await axios.get(url, { timeout: 10000 });
  return data; // expected: { open: Trade[], closed: Trade[] } or array of Trade
}

async function fetchPerformance() {
  const url = `${BASE}/api/performance`;
  const { data } = await axios.get(url, { timeout: 10000 });
  return data; // shape depends on server; handle defensively
}

async function postAnalyze(symbolA, symbolB, limit) {
  const url = `${BASE}/api/analyze`;
  const body = { symbolA, symbolB };
  if (limit && Number.isFinite(Number(limit))) body.limit = Number(limit);
  const { data } = await axios.post(url, body, { timeout: 20000 });
  return data; // include metrics and narrative when available
}

function fmtTrade(t) {
  const ts = t.timestamp ? new Date(t.timestamp).toLocaleString() : 'N/A';
  const upnl = typeof t.upnlPct === 'number' ? `${t.upnlPct >= 0 ? '+' : ''}${t.upnlPct.toFixed(2)}%` : 'N/A';
  const corr = typeof t.correlation === 'number' ? t.correlation.toFixed(2) : 'N/A';
  const z = typeof t.zScore === 'number' ? t.zScore.toFixed(2) : 'N/A';
  const status = t.status?.toUpperCase?.() || 'OPEN';
  const action = t.action?.toUpperCase?.() || t.signal || '-';
  return [
    `• ${t.pair || `${t.symbolA}/${t.symbolB}`}`,
    `  Action: ${action} | Status: ${status}`,
    `  PnL: ${upnl} | Z: ${z} | Corr: ${corr}`,
    `  Since: ${ts}`,
  ].join('\n');
}

function fmtPerformance(p) {
  if (!p || typeof p !== 'object') return 'No performance data yet.';
  const total = p.totalTrades ?? p.total ?? 0;
  const winRate = p.winRate != null ? `${(p.winRate * 100).toFixed(1)}%` : (p.winRatePct != null ? `${p.winRatePct.toFixed(1)}%` : 'N/A');
  const avgPnL = p.avgPnL != null ? `${p.avgPnL.toFixed(2)}%` : 'N/A';
  const apy = p.apy != null ? `${p.apy.toFixed(2)}%` : (p.annualizedReturnPct != null ? `${p.annualizedReturnPct.toFixed(2)}%` : 'N/A');
  const sharpe = p.sharpe != null ? p.sharpe.toFixed(2) : 'N/A';
  return [
    `Trades: ${total}`,
    `Win rate: ${winRate}`,
    `Avg PnL: ${avgPnL}`,
    `APY: ${apy}`,
    `Sharpe: ${sharpe}`,
  ].join('\n');
}

bot.start(guard(async (ctx) => {
  await ctx.reply('Welcome to PairAgent Bot!\nCommands:\n/trades\n/performance\n/analyze SYMBOL_A SYMBOL_B [limit]');
}));

bot.command('trades', guard(async (ctx) => {
  const data = await fetchTrades();
  const open = Array.isArray(data?.open) ? data.open : Array.isArray(data) ? data : [];
  const closed = Array.isArray(data?.closed) ? data.closed : [];

  if (open.length === 0 && closed.length === 0) {
    return ctx.reply('No trades yet.');
  }

  const parts = [];
  if (open.length) {
    parts.push('*Open trades*');
    parts.push(...open.map(fmtTrade));
  }
  if (closed.length) {
    parts.push('', '*Recent closed*');
    parts.push(...closed.slice(0, 5).map(fmtTrade));
  }

  // Telegram MarkdownV2 can be finicky; send plain text for simplicity
  const text = parts.join('\n');
  await ctx.reply(text);
}));

bot.command('performance', guard(async (ctx) => {
  const p = await fetchPerformance();
  await ctx.reply(fmtPerformance(p));
}));

bot.command('analyze', guard(async (ctx) => {
  const args = (ctx.message?.text || '').split(/\s+/).slice(1);
  if (args.length < 2) {
    return ctx.reply('Usage: /analyze SYMBOL_A SYMBOL_B [limit]');
  }
  const [symbolA, symbolB, limit] = args;
  const res = await postAnalyze(symbolA.toUpperCase(), symbolB.toUpperCase(), limit);

  // Try to format a concise response
  const z = res?.metrics?.zScore ?? res?.zScore;
  const corr = res?.metrics?.corr ?? res?.corr;
  const mean = res?.metrics?.mean ?? res?.mean;
  const std = res?.metrics?.std ?? res?.std;
  const beta = res?.metrics?.beta ?? res?.beta;
  const narrative = res?.narrative || res?.insight || '';

  const lines = [
    `Analyze ${symbolA}/${symbolB}`,
    z != null && corr != null ? `Z=${z.toFixed?.(2) ?? z}, Corr=${corr.toFixed?.(2) ?? corr}` : '',
    mean != null && std != null ? `Spread mean=${Number(mean).toFixed?.(2) ?? mean}, std=${Number(std).toFixed?.(2) ?? std}` : '',
    beta != null ? `Beta=${Number(beta).toFixed?.(3) ?? beta}` : '',
    narrative ? `\n${narrative}` : '',
  ].filter(Boolean);

  await ctx.reply(lines.join('\n'));
}));

// Basic error logging
bot.catch((err, ctx) => {
  console.error('[BOT] Telegraf error for update', ctx.updateType, err);
});

// Start long polling (simple for local dev)
bot.launch().then(() => {
  console.log('[BOT] Telegram bot started');
}).catch((err) => {
  console.error('[BOT] Failed to start', err);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
```

---

## 4) Run the bot

In PowerShell:

```powershell
# From docs\samples\telegram-bot
$env:TELEGRAM_BOT_TOKEN="<your token>"; $env:AGENT_API_BASE="https://pair-agent.onrender.com"; node bot.mjs
```

Or use the `.env` file created earlier:

```powershell
node --env-file=.env bot.mjs
```

You should see:

```
[BOT] Telegram bot started
```

Open Telegram, send `/start` to your bot, then try `/trades` and `/performance`.

---

## 5) Optional: schedule push alerts for new trades

For a quick push notifier, you can poll `/api/trades` every N minutes and notify on new `open` trades:

```js
let lastSeenIds = new Set();

async function pollNewTrades() {
  try {
    const data = await fetchTrades();
    const open = Array.isArray(data?.open) ? data.open : Array.isArray(data) ? data : [];
    for (const t of open) {
      const key = `${t.id || ''}-${t.pair}-${t.timestamp || ''}`;
      if (!lastSeenIds.has(key)) {
        lastSeenIds.add(key);
        await bot.telegram.sendMessage(
          allowedIds[0] || ctx.chat.id, // pick your chat ID or maintain a list per chat
          `New trade opened:\n${fmtTrade(t)}`
        );
      }
    }
  } catch (e) {
    console.warn('[BOT] pollNewTrades failed:', e.message || e);
  }
}

setInterval(pollNewTrades, 60_000 * 5); // every 5 minutes
```

For production, prefer webhooks instead of long polling and a proper scheduler/worker (e.g., a tiny service with PM2).

---

## 6) Troubleshooting

- 401/403 from /api/*: ensure your PairAgent service doesn’t require extra auth for local use (or add headers in axios calls).
- Empty /api/trades: the agent may have no history yet; open a few trades or wait for a cycle.
- Large messages: Telegram limits message size; if responses grow too big, truncate or send batches.
- Rate limiting: space out requests and avoid hammering the API.
- Windows service: use `pm2` on Windows (`npm i -g pm2`) or NSSM to run the bot automatically on startup.

---

## 7) Security notes

- Keep your `TELEGRAM_BOT_TOKEN` secret.
- Use `ALLOWED_CHAT_IDS` to restrict access.
- If you expose the agent API publicly, add auth (e.g., bearer token) and update axios headers in the bot.

---

## 8) Quick reference (endpoints)

- GET `${AGENT_API_BASE}/api/trades` — returns open/closed trades (shape may vary; handle defensively).
- GET `${AGENT_API_BASE}/api/performance` — returns performance summary.
- POST `${AGENT_API_BASE}/api/analyze` — body: `{ symbolA, symbolB, limit? }`; returns metrics and narrative.

---

That’s it — you now have a Telegram bot that can pull live trades and performance from your PairAgent! 🎯
