# 🚀 Pair-Agent Quick Reference

## Project Built Successfully! ✅

Your autonomous pair-trading analysis agent is now running and detected its first trade signal!

## 📊 First Run Results

### Trade Signal Detected
- **Pair**: ETHUSDT/BNBUSDT
- **Signal**: SHORT (mean reversion opportunity)
- **Z-Score**: 2.36σ above mean
- **Correlation**: 0.84
- **Action**: Short ETHUSDT, Long BNBUSDT
- **Reasoning**: Spread elevated 2.36 standard deviations above historical mean

### Analysis Summary
✅ **BTC/ETH**: No signal (z-score 1.3σ, within normal range)  
⚡ **ETH/BNB**: Trade signal! (z-score 2.4σ, correlation 0.84)

## 🎮 Commands

```powershell
# Build the project
npm run build

# Start the agent (runs every hour)
npm start

# Development mode (watch for changes)
npm run dev
```

## 📁 Key Files Created

```
pair-agent/
├── src/
│   ├── fetcher.ts          ✅ Binance API integration with retry logic
│   ├── pair_analysis.ts    ✅ Correlation, beta, z-score calculations
│   ├── narrative.ts         ✅ Natural language explanations
│   ├── executor.ts          ✅ Trade simulation & logging
│   └── index.ts             ✅ Main orchestrator with 1-hour loop
├── eliza.config.json        ✅ Agent configuration
├── trades.json              ✅ Simulated trade log (auto-created)
├── package.json             ✅ Dependencies
├── tsconfig.json            ✅ TypeScript strict mode config
├── README.md                ✅ Full documentation
└── .github/
    └── copilot-instructions.md  ✅ AI agent guidance
```

## 🔧 Configuration

Edit `eliza.config.json` to customize:

```json
{
  "pairs": [
    { "pairA": "BTCUSDT", "pairB": "ETHUSDT" },
    { "pairA": "ETHUSDT", "pairB": "BNBUSDT" }
  ],
  "analysis": {
    "lookbackPeriod": 100,        // Historical data points
    "updateInterval": 3600000,     // 1 hour in ms
    "zScoreThreshold": 2.0,        // Signal threshold
    "correlationThreshold": 0.8    // Minimum correlation
  }
}
```

## 🧮 How It Works

1. **Fetch** → Downloads 100 hourly candles from Binance
2. **Analyze** → Computes correlation, beta, z-score
3. **Evaluate** → Checks if |z-score| > 2 and corr > 0.8
4. **Signal** → Generates trade recommendation
5. **Execute** → Simulates trade (logs to `trades.json`)
6. **Repeat** → Runs every hour automatically

## 🎯 Current Status

- ✅ All modules built and tested
- ✅ TypeScript strict mode enabled
- ✅ Live data from Binance API
- ✅ First trade signal detected and logged
- ✅ Agent running in continuous mode

## 📈 Example Output

```
ETHUSDT/BNBUSDT spread is 2.4σ above mean (2686.22 ± 52.23), 
correlation 0.84. Spread elevated — possible short ETHUSDT, 
long BNBUSDT reversion trade.
```

## 🔮 Next Steps

### 1. Monitor Live Performance
The agent is now running and will analyze pairs every hour. Check `trades.json` for logged trades.

### 2. Add More Pairs
Edit `eliza.config.json` to track additional pairs:
```json
{ "pairA": "SOLUSDT", "pairB": "AVAXUSDT" }
```

### 3. Integrate Eliza LLM
Replace mock LLM in `src/narrative.ts`:
```typescript
import { llm } from '@elizaos/core';
const insight = await llm.complete(buildLLMPrompt(...));
```

### 4. Connect Real Trading
Integrate ethers.js or exchange API in `src/executor.ts` for live execution.

### 5. Add Notifications
Send alerts via Telegram/Discord when signals detected.

## 🛠️ Troubleshooting

**Build errors?**
```powershell
npm install
npm run build
```

**API rate limits?**
- Binance allows ~1200 requests/minute
- Current config uses ~2 requests/hour (very safe)

**Want faster updates?**
Change `updateInterval` in config (in milliseconds):
- 15 min = 900000
- 30 min = 1800000
- 1 hour = 3600000

## 📚 Documentation

- Full README: `README.md`
- AI Instructions: `.github/copilot-instructions.md`
- Trade Log: `trades.json`

---

**Your pair-agent is ready to trade! 🍐📈**
