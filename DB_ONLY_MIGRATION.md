# Database-Only Storage Migration

The system has been updated to use **database-only storage** with no file-based fallbacks.

## What Changed

### Removed File-Based Fallbacks

1. **Trade History (`src/executor.ts`)**:
   - `loadTradeHistory()`: Now loads only from database; throws error if DB fails
   - `saveTradeHistory()`: Deprecated (no-op); trades auto-save to DB in real-time
   - Removed all `fs.readFile/writeFile` fallback code

2. **Performance Metrics (`src/performance.ts`)**:
   - `savePerformanceMetrics()`: Removed `filepath` parameter; saves only to DB
   - `loadPerformanceMetrics()`: Removed `filepath` parameter; loads only from DB
   - Removed all file-based fallback code

3. **Updated Calls**:
   - `src/index.ts`: Changed `loadTradeHistory('./trades.json')` → `loadTradeHistory()`

### Behavior Changes

**Before:**
- Trades and metrics saved to JSON files as primary storage
- Database used as secondary/optional storage
- Errors fell back to file storage silently

**After:**
- Database is the **only** source of truth
- Real-time DB writes on every trade open/close/update
- Errors throw exceptions (fail-fast approach)
- JSON files are fully deprecated

### Error Handling

If database connection fails:
- System will throw clear errors instead of silently falling back
- Ensures data consistency (no split-brain between file and DB)
- Forces proper DATABASE_URL configuration

## Migration Path

### If You Have Existing `trades.json`

Run the one-time migration script before deployment:

```powershell
# Ensure DATABASE_URL is in .env
npm run build
node scripts/migrate.ts
```

This imports legacy trades into the database.

### If Starting Fresh

Just deploy with `DATABASE_URL` set. Tables will be created automatically.

## Files Modified

- `src/executor.ts` - Removed file fallbacks from load/save
- `src/performance.ts` - Removed file fallbacks from save/load
- `src/index.ts` - Updated loadTradeHistory() call
- `.gitignore` - Added performance.json, marked both JSON files as deprecated

## Benefits

1. **Single Source of Truth**: Database is authoritative
2. **Real-Time Sync**: All changes immediately persisted
3. **Scalability**: No file locking issues
4. **Observability**: All data queryable via SQL
5. **Deployment Ready**: Works on serverless/containerized platforms (Render, Vercel, etc.)

## Rollback (Emergency Only)

If you need to revert to file-based storage, check out the previous git commit before this change.

## Next Steps

1. Run `npm run migrate:schema` to fix numeric overflow (if not done)
2. Run `npm run smoke:db` to verify DB connectivity
3. Deploy to Render Web Service with DATABASE_URL set
4. Verify endpoints: `/health`, `/api/trades`, `/api/performance`

## Notes

- Legacy JSON files (`trades.json`, `performance.json`) are now ignored by git
- The migration script (`scripts/migrate.ts`) remains for one-time imports
- `exportTradeHistory()` in executor.ts still works (for debugging/exports)
