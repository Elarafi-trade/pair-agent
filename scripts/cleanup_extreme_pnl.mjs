import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function main() {
  console.log('[CLEANUP] Checking for extreme PnL values...');

  // Find trades with extreme PnL (likely bad price data)
  const extremeTrades = await sql`
    SELECT id, pair, close_pnl, upnl_pct, status
    FROM trades
    WHERE ABS(close_pnl) > 500 OR ABS(upnl_pct) > 500
    ORDER BY ABS(COALESCE(close_pnl, upnl_pct)) DESC
  `;

  if (extremeTrades.length === 0) {
    console.log('[CLEANUP] ✅ No extreme PnL values found');
    return;
  }

  console.log(`[CLEANUP] Found ${extremeTrades.length} trade(s) with extreme PnL:`);
  for (const trade of extremeTrades) {
    console.log(`  - ${trade.pair}: PnL=${trade.close_pnl || trade.upnl_pct}% (status=${trade.status})`);
  }

  // Cap extreme values at ±500%
  const updated = await sql`
    UPDATE trades
    SET 
      close_pnl = CASE 
        WHEN close_pnl > 500 THEN 500
        WHEN close_pnl < -500 THEN -500
        ELSE close_pnl
      END,
      upnl_pct = CASE 
        WHEN upnl_pct > 500 THEN 500
        WHEN upnl_pct < -500 THEN -500
        ELSE upnl_pct
      END
    WHERE ABS(close_pnl) > 500 OR ABS(upnl_pct) > 500
  `;

  console.log(`[CLEANUP] ✅ Capped ${extremeTrades.length} PnL value(s) at ±500%`);
  console.log('[CLEANUP] These were likely caused by bad price data (prices near zero)');
  console.log('[CLEANUP] Future trades will be capped automatically');
}

main().catch((err) => {
  console.error('[CLEANUP] Error:', err);
  process.exit(1);
});
