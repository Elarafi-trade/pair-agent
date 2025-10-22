# 🚀 Quick Start - Deploy to Vercel + Neon# 🚀 Pair-Agent Quick Reference



## ✅ What You Have Now## Project Built Successfully! ✅



- **Backend**: Pair trading agent that writes to Neon PostgresYour autonomous pair-trading analysis agent is now running and detected its first trade signal!

- **Frontend**: Next.js dashboard that reads from Neon Postgres  

- **Database**: Shared Neon database for trades and performance metrics## 📊 First Run Results



---### Trade Signal Detected

- **Pair**: ETHUSDT/BNBUSDT

## 📋 Step-by-Step Deployment- **Signal**: SHORT (mean reversion opportunity)

- **Z-Score**: 2.36σ above mean

### 1. Create Neon Database (2 minutes)- **Correlation**: 0.84

- **Action**: Short ETHUSDT, Long BNBUSDT

1. Go to https://console.neon.tech/- **Reasoning**: Spread elevated 2.36 standard deviations above historical mean

2. Sign up/Login (free - use GitHub)

3. Click **Create Project**### Analysis Summary

   - Name: `pair-trading-db`✅ **BTC/ETH**: No signal (z-score 1.3σ, within normal range)  

   - Region: Choose closest to you⚡ **ETH/BNB**: Trade signal! (z-score 2.4σ, correlation 0.84)

   - Postgres: 16

4. **Copy the connection string** (starts with `postgresql://`)## 🎮 Commands



---```powershell

# Build the project

### 2. Set Up Local Environmentnpm run build



Create `.env` file in project root:# Start the agent (runs every hour)

npm start

```bash

cd D:\Projects\pair-agent# Development mode (watch for changes)

notepad .envnpm run dev

``````



Add your Neon connection string:## 📁 Key Files Created



```env```

DATABASE_URL=postgresql://your-connection-string-herepair-agent/

```├── src/

│   ├── fetcher.ts          ✅ Binance API integration with retry logic

---│   ├── pair_analysis.ts    ✅ Correlation, beta, z-score calculations

│   ├── narrative.ts         ✅ Natural language explanations

### 3. Migrate Existing Data (Optional)│   ├── executor.ts          ✅ Trade simulation & logging

│   └── index.ts             ✅ Main orchestrator with 1-hour loop

If you have existing `trades.json` data:├── eliza.config.json        ✅ Agent configuration

├── trades.json              ✅ Simulated trade log (auto-created)

```powershell├── package.json             ✅ Dependencies

npx tsx scripts/migrate.ts├── tsconfig.json            ✅ TypeScript strict mode config

```├── README.md                ✅ Full documentation

└── .github/

This will:    └── copilot-instructions.md  ✅ AI agent guidance

- ✅ Create database tables```

- ✅ Import all trades from `trades.json`

- ✅ Preserve trade history and status## 🔧 Configuration



---Edit `eliza.config.json` to customize:



### 4. Test Backend Locally```json

{

```powershell  "pairs": [

npm start    { "pairA": "BTCUSDT", "pairB": "ETHUSDT" },

```    { "pairA": "ETHUSDT", "pairB": "BNBUSDT" }

  ],

Backend will now:  "analysis": {

- ✅ Load trades from Neon database    "lookbackPeriod": 100,        // Historical data points

- ✅ Save new trades to Neon    "updateInterval": 3600000,     // 1 hour in ms

- ✅ Update UPnL in real-time    "zScoreThreshold": 2.0,        // Signal threshold

- ✅ Still create `trades.json` as fallback    "correlationThreshold": 0.8    // Minimum correlation

  }

---}

```

### 5. Deploy Frontend to Vercel

## 🧮 How It Works

```powershell

# Install Vercel CLI (if not installed)1. **Fetch** → Downloads 100 hourly candles from Binance

npm install -g vercel2. **Analyze** → Computes correlation, beta, z-score

3. **Evaluate** → Checks if |z-score| > 2 and corr > 0.8

# Deploy frontend4. **Signal** → Generates trade recommendation

vercel5. **Execute** → Simulates trade (logs to `trades.json`)

```6. **Repeat** → Runs every hour automatically



**During prompts:**## 🎯 Current Status

- Set up and deploy: **Yes**

- Scope: Choose your account- ✅ All modules built and tested

- Link to existing project: **No**  - ✅ TypeScript strict mode enabled

- Project name: `pair-agent` (or your choice)- ✅ Live data from Binance API

- In which directory: `./web`- ✅ First trade signal detected and logged

- Override settings: **No**- ✅ Agent running in continuous mode



---## 📈 Example Output



### 6. Add Database URL to Vercel```

ETHUSDT/BNBUSDT spread is 2.4σ above mean (2686.22 ± 52.23), 

After deployment completes:correlation 0.84. Spread elevated — possible short ETHUSDT, 

long BNBUSDT reversion trade.

1. Go to https://vercel.com/dashboard```

2. Select your `pair-agent` project

3. Go to **Settings** → **Environment Variables**## 🔮 Next Steps

4. Add new variable:

   - Name: `DATABASE_URL`### 1. Monitor Live Performance

   - Value: Your Neon connection stringThe agent is now running and will analyze pairs every hour. Check `trades.json` for logged trades.

   - Environments: **Production**, **Preview**, **Development** (all 3)

5. Click **Save**### 2. Add More Pairs

Edit `eliza.config.json` to track additional pairs:

---```json

{ "pairA": "SOLUSDT", "pairB": "AVAXUSDT" }

### 7. Deploy to Production```



```powershell### 3. Integrate Eliza LLM

vercel --prodReplace mock LLM in `src/narrative.ts`:

``````typescript

import { llm } from '@elizaos/core';

Your dashboard is now live! 🎉const insight = await llm.complete(buildLLMPrompt(...));

```

---

### 4. Connect Real Trading

## 🎯 What Happens NowIntegrate ethers.js or exchange API in `src/executor.ts` for live execution.



### Frontend (Vercel)### 5. Add Notifications

- Lives at: `https://your-app.vercel.app`Send alerts via Telegram/Discord when signals detected.

- Reads trades from Neon database

- Auto-updates every 10 seconds## 🛠️ Troubleshooting

- Shows real-time performance metrics

**Build errors?**

### Backend (Local/VPS)```powershell

- Runs on your machine (or deploy to VPS later)npm install

- Writes trades to Neon databasenpm run build

- Both frontend and backend share the same data!```



---**API rate limits?**

- Binance allows ~1200 requests/minute

## 🧪 Testing Your Deployment- Current config uses ~2 requests/hour (very safe)



### Test API Endpoints**Want faster updates?**

Change `updateInterval` in config (in milliseconds):

```powershell- 15 min = 900000

# Check trades- 30 min = 1800000

curl https://your-app.vercel.app/api/trades- 1 hour = 3600000



# Check performance## 📚 Documentation

curl https://your-app.vercel.app/api/performance

```- Full README: `README.md`

- AI Instructions: `.github/copilot-instructions.md`

### Test Frontend- Trade Log: `trades.json`



Open browser: `https://your-app.vercel.app`---



You should see:**Your pair-agent is ready to trade! 🍐📈**

- ✅ Performance card (purple gradient)
- ✅ Trade signal cards
- ✅ Charts (Z-Score, Spread, Volatility)
- ✅ Open positions list

---

## 🔥 Pro Tips

### Run Backend 24/7

**Option A: Keep Computer On**
```powershell
npm start
```

**Option B: Deploy to VPS** (Render, Railway, DigitalOcean)
- Copy project to VPS
- Add same `.env` file
- Run `npm start`

### Monitor Logs

**Backend:**
```powershell
npm start
```

**Vercel Frontend:**
```powershell
vercel logs
```

### Update Frontend

```powershell
# Make changes to web/ folder
# Then redeploy
vercel --prod
```

### Update Backend

```powershell
# Make changes to src/ folder
npm run build
npm start
```

---

## 🐛 Troubleshooting

### Frontend shows no trades

**Check:**
1. DATABASE_URL set in Vercel env vars?
2. Run migration script to import data
3. Backend is running and writing to database

**Fix:**
```powershell
# Re-add env var in Vercel dashboard
# Then redeploy
vercel --prod
```

### Backend can't connect to database

**Check:**
1. DATABASE_URL in `.env` file?
2. Connection string has `?sslmode=require` at end?

**Fix:**
```bash
# .env format should be:
DATABASE_URL=postgresql://user:pass@host.neon.tech/db?sslmode=require
```

### Database tables don't exist

**Fix:**
```powershell
# Run migration script - it creates tables
npx tsx scripts/migrate.ts
```

---

## 🌟 What's Next?

### Advanced Features

1. **Add Telegram Notifications**
   - Install `node-telegram-bot-api`
   - Send trade signals to Telegram

2. **Deploy Backend to Cloud**
   - Use Render/Railway for 24/7 uptime
   - Same Neon database, both share data

3. **Add More Pairs**
   - Edit `eliza.config.json`
   - Increase `randomPairCount`

4. **Enable Live Trading**
   - Integrate exchange API (Binance, Coinbase)
   - Update `executor.ts` with real orders

---

## 📞 Need Help?

**Common Commands:**

```powershell
# Build backend
npm run build

# Start agent
npm start

# Deploy frontend
vercel --prod

# Migrate data
npx tsx scripts/migrate.ts

# View Vercel logs
vercel logs --follow
```

**Environment Check:**

```powershell
# Check if DATABASE_URL is set
echo $env:DATABASE_URL
```

---

## ✅ Deployment Checklist

- [ ] Created Neon database
- [ ] Added DATABASE_URL to `.env`
- [ ] Ran migration script (if needed)
- [ ] Tested backend locally
- [ ] Deployed frontend to Vercel
- [ ] Added DATABASE_URL to Vercel env vars
- [ ] Verified frontend shows trades
- [ ] Backend is running and saving trades

---

**Your pair trading agent is now production-ready!** 🚀

Frontend: Live on Vercel  
Backend: Running locally (or deploy to VPS)  
Database: Neon Postgres (shared)
