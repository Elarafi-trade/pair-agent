# Deployment Guide - Pair Trading Agent on Vercel + Neon

## ✅ What's Been Set Up

1. **Neon Serverless Postgres Integration**
   - `web/lib/db.ts` - Database client with all CRUD operations
   - API routes updated to use Postgres instead of JSON files
   - Schema includes `trades` and `performance_metrics` tables

2. **Vercel Configuration**
   - `vercel.json` configured for Next.js monorepo deployment
   - Routes all traffic to `web/` folder

## 📋 Deployment Steps

### 1. Create Neon Database (FREE)

1. Go to [Neon Console](https://console.neon.tech/)
2. Sign up/Login (can use GitHub)
3. Click **Create Project**
   - Project name: `pair-trading-db`
   - Region: Choose closest to your users
   - Postgres version: 16 (recommended)
4. Click **Create Project**
5. Copy the connection string shown (starts with `postgresql://`)

### 2. Install Neon Serverless Package

```powershell
cd web
npm install @neondatabase/serverless
```

### 3. Create Vercel Project

```powershell
# Install Vercel CLI globally (if not already installed)
npm install -g vercel

# Navigate to project root
cd D:\Projects\pair-agent

# Deploy (this will prompt you to configure)
vercel
```

**During `vercel` prompt:**
- Set up and deploy: **Yes**
- Which scope: Choose your account
- Link to existing project: **No**
- Project name: `pair-agent` (or your choice)
- In which directory is your code located: `./web`
- Override settings: **No**

### 4. Add Database URL to Vercel

After initial deployment:

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add a new variable:
   - **Name**: `DATABASE_URL`
   - **Value**: Paste your Neon connection string (from step 1)
   - **Environment**: Production, Preview, Development (select all)
4. Click **Save**

### 5. Deploy to Production

```powershell
vercel --prod
```

The database tables will be automatically created on first API call via `initializeTables()`.

### 6. (Optional) Test Locally with Neon

Create a `.env.local` file in the `web/` folder:

```env
DATABASE_URL=postgresql://your-connection-string-from-neon
```

Then run locally:
```powershell
cd web
npm run dev
```

## 🔄 Backend Agent Setup

Your backend agent (`src/index.ts`) currently writes to local JSON files. You have **two options**:

### **Option A: Keep Backend Local** (Recommended for now)
- Keep agent running on your local machine/VPS
- Frontend on Vercel reads from Postgres
- You'll need to update `src/executor.ts` and `src/performance.ts` to write to Postgres instead of JSON

### **Option B: Serverless Backend**
- Deploy backend as separate Vercel serverless functions
- Would require significant refactoring (continuous loops → cron jobs)
- More complex but fully cloud-native

## 🛠️ Next Steps - Backend Database Integration

To connect your backend agent to write to the same Neon database:

1. **Install Neon in backend:**
   ```powershell
   npm install @neondatabase/serverless dotenv
   ```

2. **Create `.env` file in project root:**
   ```env
   DATABASE_URL=postgresql://your-neon-connection-string
   ```

3. **Update backend files:**
   - Copy `web/lib/db.ts` → `src/db.ts` (reuse database functions)
   - Add at top of `src/index.ts`:
     ```typescript
     import 'dotenv/config';
     ```
   - Modify `src/executor.ts` to use `insertTrade()`, `closeTrade()`, `updateTradePnL()`
   - Modify `src/performance.ts` to use `savePerformanceMetrics()`

4. **Remove JSON file operations:**
   - Replace `fs.writeFileSync(./trades.json)` with database calls
   - Replace `fs.readFileSync(./trades.json)` with `getOpenTrades()`, `getAllTrades()`

## 🧪 Testing

After deployment, test the API routes:

```powershell
# Check trades endpoint
curl https://your-app.vercel.app/api/trades

# Check performance endpoint
curl https://your-app.vercel.app/api/performance
```

## 📊 Migration Script

To migrate your existing `trades.json` data to Neon, create `scripts/migrate.ts`:

```typescript
import 'dotenv/config';
import { readFileSync } from 'fs';
import { insertTrade, initializeTables } from '../web/lib/db';

async function migrate() {
  await initializeTables();
  
  const trades = JSON.parse(readFileSync('./trades.json', 'utf-8'));
  
  for (const trade of trades) {
    await insertTrade(trade);
  }
  
  console.log(`Migrated ${trades.length} trades`);
}

migrate();
```

Run with:
```powershell
npx tsx scripts/migrate.ts
```

## 🎯 Summary

✅ **Frontend**: Ready to deploy to Vercel with Neon Postgres  
⚠️ **Backend**: Still using JSON files - needs update to write to Neon  
📝 **Next**: Update `src/executor.ts` and `src/performance.ts` to use database functions

---

## 🌟 Why Neon?

- **Free tier**: 512 MB storage, 0.5 GB data transfer
- **Serverless**: Auto-scales to zero, pay only for usage
- **Postgres compatible**: Works with all standard Postgres tools
- **Low latency**: Edge network for fast global access
- **Branching**: Database branches for dev/staging/prod

---

**Need help?** Let me know if you want me to:
1. Update backend to write to Neon
2. Create migration script for existing data
3. Set up automated deployment with GitHub Actions
