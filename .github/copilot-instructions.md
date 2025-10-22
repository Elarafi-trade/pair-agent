# 🧠 Project: pair-agent

## Goal
Build an autonomous pair-trading analysis agent (like Agent Pear https://app.pear.garden/agent-pear) using Eliza OS.
The agent continuously monitors crypto pairs, computes correlations and z-scores, detects mean-reversion opportunities, explains its reasoning in natural language, and optionally simulates or executes trades.

## 🪶 Tech Stack
- **Eliza OS** (agent framework)
- **TypeScript** for computation logic (strict mode)
- **axios** for market-data APIs (Binance, CoinGecko)
- **mathjs** for stats (correlation, std, mean, z-score)
- **ethers.js** (optional) for trade execution simulation

## 📁 Project Structure
```
pair-agent/
├── src/
│   ├── fetcher.ts          # API data fetching (Binance, CoinGecko)
│   ├── pair_analysis.ts    # Correlation, beta, z-score computation
│   ├── narrative.ts         # LLM-based trade signal explanations
│   ├── executor.ts          # Trade simulation/execution (optional)
│   └── index.ts             # Main orchestrator with 1-hour loop
├── eliza.config.json        # Eliza OS configuration & tracked pairs
├── package.json             # Dependencies: axios, mathjs, @elizaos/*
└── tsconfig.json            # Strict TypeScript settings
```

## 🎯 General Rules
- Use **TypeScript strict mode** with ES modules (`import`/`export`)
- Write clean `async` functions with proper error handling
- Keep modules small and focused (single responsibility)
- Add comments explaining math/reasoning, especially for z-score/correlation logic
- All logic must be **deterministic and testable**
- Avoid callbacks—use `async/await` consistently

## 🚀 Setup & Run Commands
```powershell
# Initialize project
npm init -y
npm install --save axios mathjs @elizaos/core
npm install --save-dev typescript @types/node

# Build
npx tsc

# Run agent (after building)
node dist/index.js

# Development watch mode
npx tsc --watch
```

## 🧩 Agent Purpose
"You are helping build an autonomous pair-trading AI agent inside Eliza OS that monitors crypto pairs, detects divergences, and generates trade signals."

**Copilot should:**
- Generate data fetchers for exchange APIs (Binance, CoinGecko, etc.)
- Implement pair-analysis functions that compute correlation, beta, and z-score
- Create LLM prompt builders for Eliza's reasoning layer
- Support periodic background execution (every hour)
- Optionally integrate with ethers.js for trade execution simulation

# 🧮 Core Logic Guidelines
fetcher.ts

Function: fetchPairData(pairA, pairB)

Fetch hourly candle data using REST API

Return parsed closing prices only

Handle network errors gracefully

pair_analysis.ts

Compute:

Returns for both pairs

Correlation coefficient

Spread = PriceA − β × PriceB

Mean, std, and current z-score

Output object { corr, beta, zScore, mean, std }

narrative.ts

Use Eliza LLM to interpret metrics:

Input: metrics + pair names

Output: 1–2 sentence summary like
“BTC/ETH spread is 2.1σ above mean, correlation 0.92 — possible short BTC, long ETH reversion trade.”

executor.ts (optional)

Simulate trades via ethers.js or mock engine

Log executed trade, timestamp, reason

index.ts

Load config from eliza.config.json

Iterate through tracked pairs

Fetch → analyze → narrate → (optionally execute)

Schedule repeat every 1 hour

# ⚙️ Example Prompts for Copilot

To guide Copilot while coding, use inline comments like:

// Copilot: Fetch the last 100 hourly klines for BTCUSDT and ETHUSDT from Binance API

// Copilot: Compute correlation and z-score between two price arrays

// Copilot: Generate a natural-language summary explaining the pair-trading signal using metrics

// Copilot: Create a function to simulate a trade and log results to console

// Copilot: Add a loop to run analysis every 1 hour using setInterval

# 🧠 Prompting Style

Always use imperative comments (// Copilot: ...)

Avoid vague prompts (“analyze this”) — be explicit (“compute correlation and z-score of BTC/ETH”)

When defining interfaces, tell Copilot exactly what the structure should look like

// Copilot: Define an interface TradeSignal with fields pair, zScore, direction, timestamp

# 🧩 Example Task Flow

fetcher.ts → fetch prices

pair_analysis.ts → compute metrics

narrative.ts → generate AI summary

executor.ts → simulate or execute

index.ts → orchestrate and loop

# 🧰 Enhancements for Copilot

Encourage Copilot to:

Add moving-average smoothing on spreads

Detect cointegration using Engle-Granger test

Store trade logs in JSON or Supabase

Add Telegram/Discord notifications when signal generated

Visualize results with quick ASCII plots in console

# 🧱 Example Feature Prompt

“Copilot: Add a function that checks if absolute z-score > 2 and correlation > 0.8, then classify as ‘trade signal’. Return JSON {pair, zScore, corr, signalType}.”

# 💬 Eliza Integration

Use llm.complete(prompt) or agent.respond(prompt) for narrative generation.

Keep prompt context short and data-focused.

Example:

const prompt = `
Analyze BTC/ETH pair:
Corr: 0.93
Z-Score: 2.5
Mean: 12.3
Std: 4.8
`;
const insight = await llm.complete(prompt);

# ✅ Final Deliverable

Fully functional autonomous pair-trading analysis agent

Modular TypeScript code

Human-readable AI commentary

Optional simulated execution