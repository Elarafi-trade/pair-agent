# Pair-Agent

An autonomous pair-trading analysis agent built with TypeScript that monitors crypto pairs, computes correlations and z-scores, detects mean-reversion opportunities, and explains its reasoning in natural language.

## 🎯 Features

- **Automated pair analysis** - Monitors multiple crypto pairs continuously
- **Statistical computation** - Calculates correlation, beta, z-score, and spread
- **Natural language explanations** - Generates human-readable trading insights
- **Trade simulation** - Simulates pair-trading execution and logs results
- **Configurable thresholds** - Customize z-score and correlation criteria
- **Periodic execution** - Runs analysis every hour (configurable)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```powershell
# Install dependencies
npm install

# Build the project
npm run build

# Run the agent
npm start
```

### Development Mode

```powershell
# Watch mode (auto-rebuild on changes)
npm run dev

# In another terminal, run the agent
npm start
```

## ⚙️ Configuration

Edit `eliza.config.json` to customize:

```json
{
  "pairs": [
    {
      "pairA": "BTCUSDT",
      "pairB": "ETHUSDT",
      "description": "BTC/ETH correlation analysis"
    }
  ],
  "analysis": {
    "lookbackPeriod": 100,
    "updateInterval": 3600000,
    "zScoreThreshold": 2.0,
    "correlationThreshold": 0.8
  }
}
```

### Configuration Options

- `lookbackPeriod` - Number of hourly candles to analyze (default: 100)
- `updateInterval` - Time between analysis cycles in ms (default: 3600000 = 1 hour)
- `zScoreThreshold` - Minimum absolute z-score for trade signal (default: 2.0)
- `correlationThreshold` - Minimum correlation for trade signal (default: 0.8)

## 📁 Project Structure

```
pair-agent/
├── src/
│   ├── fetcher.ts          # Binance API data fetching
│   ├── pair_analysis.ts    # Statistical computations
│   ├── narrative.ts         # Natural language generation
│   ├── executor.ts          # Trade simulation
│   └── index.ts             # Main orchestrator
├── eliza.config.json        # Agent configuration
├── package.json
└── tsconfig.json
```

## 🧮 How It Works

1. **Fetch Data** - Downloads hourly price data from Binance API
2. **Compute Metrics**:
   - Returns for both pairs
   - Correlation coefficient
   - Beta (hedge ratio)
   - Spread = `PriceA - β × PriceB`
   - Mean and standard deviation of spread
   - Z-score of current spread
3. **Generate Signal**:
   - Z-score > 2 → Short spread (short A, long B)
   - Z-score < -2 → Long spread (long A, short B)
   - Otherwise → Neutral
4. **Execute Trade** (simulated) - Logs trade details if criteria met
5. **Repeat** - Runs every hour (configurable)

## 📊 Example Output

```
═══════════════════════════════════════════
  PAIR ANALYSIS REPORT
═══════════════════════════════════════════
Pair:         BTCUSDT / ETHUSDT
Correlation:  0.93
Beta:         15.432
─────────────────────────────────────────────
Spread Stats:
  Mean:       12.34
  Std Dev:    4.82
  Current:    22.56
  Z-Score:    2.12
─────────────────────────────────────────────
Signal:       SHORT
─────────────────────────────────────────────
Narrative:
BTCUSDT/ETHUSDT spread is 2.1σ above mean (12.34 ± 4.82), 
correlation 0.93. Spread elevated — possible short BTCUSDT, 
long ETHUSDT reversion trade.
═══════════════════════════════════════════
```

## 🧰 Trade Log

All simulated trades are saved to `trades.json`:

```json
[
  {
    "timestamp": 1703001234567,
    "pair": "BTCUSDT/ETHUSDT",
    "action": "short",
    "zScore": 2.12,
    "correlation": 0.93,
    "reason": "Spread 2.12σ above mean — expecting reversion downward..."
  }
]
```

## 🔧 Extending the Agent

### Add More Pairs

Edit `eliza.config.json` and add pairs to the `pairs` array:

```json
{
  "pairA": "SOLUSDT",
  "pairB": "AVAXUSDT",
  "description": "SOL/AVAX analysis"
}
```

### Integrate with Eliza LLM

Replace the mock LLM in `src/narrative.ts`:

```typescript
import { llm } from '@elizaos/core';

const prompt = buildLLMPrompt(symbolA, symbolB, result);
const insight = await llm.complete(prompt);
```

### Add Real Trade Execution

Integrate ethers.js in `src/executor.ts` for on-chain execution.

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Please ensure all code follows TypeScript strict mode and includes appropriate error handling.
