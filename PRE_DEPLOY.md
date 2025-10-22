# Pre-Deployment Checklist for Render Web Service

## Issue: Numeric Field Overflow in Performance Metrics

The performance metrics table needs schema updates to handle large APY and return percentage values.

## Steps to Fix Before Deployment

### 1. Run Schema Migration Locally (Recommended)

If you have an existing Neon database with performance_metrics table:

```powershell
# Ensure DATABASE_URL is set in .env
npm run migrate:schema
```

Expected output:
```
[MIGRATION] Updating performance_metrics table schema...
[MIGRATION] ✅ Successfully updated performance_metrics columns to DECIMAL(15, 4)
[MIGRATION] These columns can now hold values up to ±999,999,999.9999
```

### 2. Alternative: Drop and Recreate (Fresh Start)

If you want to start fresh, connect to Neon via psql or their web SQL editor:

```sql
-- Drop the old table
DROP TABLE IF EXISTS performance_metrics;

-- Tables will be recreated automatically on next run with correct schema
```

### 3. Deploy to Render

After fixing the schema:

1. **Push to GitHub**:
   ```powershell
   git add .
   git commit -m "Fix: Increase precision for performance metrics to handle large values"
   git push origin main
   ```

2. **Create Render Web Service**:
   - Go to Render Dashboard → New → Web Service
   - Connect your GitHub repo: `nabil-repo/pair-agent`
   - Settings will auto-populate from `render.yaml`:
     - **Type**: Web Service
     - **Build Command**: `npm ci && npm run build`
     - **Start Command**: `npm start`
     - **Health Check Path**: `/health`

3. **Set Environment Variables**:
   - `DATABASE_URL` = your Neon connection string
   - `NODE_ENV` = `production`

4. **Deploy** and monitor logs

## What Was Fixed

### Schema Changes

Changed from `DECIMAL(10, 4)` to `DECIMAL(15, 4)` for:
- `total_return_pct`
- `total_return_pct_leveraged`
- `profit_factor`
- `estimated_apy`
- `estimated_apy_leveraged`

### Why This Matters

- Old precision: Max ±999,999.9999 (6 digits before decimal)
- New precision: Max ±99,999,999,999.9999 (11 digits before decimal)
- Allows APY and leveraged returns to reach realistic high values (e.g., 10,000%+)

## Verification

After deployment, test endpoints:

```powershell
# Health check
curl https://your-service.onrender.com/health

# Trades API
curl https://your-service.onrender.com/api/trades

# Performance API
curl https://your-service.onrender.com/api/performance
```

Check Render logs for:
- ✅ `[DB] Tables initialized successfully`
- ✅ `[PERFORMANCE] Metrics saved to database` (not falling back to file)
- ❌ No `numeric field overflow` errors

## Files Modified

- `src/db.ts` - Backend DB schema
- `web/lib/db.ts` - Frontend DB schema (if deploying Next.js later)
- `scripts/fix_performance_schema.mjs` - Migration script
- `package.json` - Added `migrate:schema` script

## Notes

- The backend will automatically create tables on first run if they don't exist
- Migration script is idempotent (safe to run multiple times)
- Existing performance_metrics records will be preserved during ALTER TABLE
