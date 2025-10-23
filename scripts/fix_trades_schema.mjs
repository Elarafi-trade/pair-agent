import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Please create a .env file with your Neon connection string.');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function main() {
  console.log('[MIGRATION] Updating trades table schema to handle large PnL values...');

  try {
    // Alter columns that can have large values (especially with leverage)
    await sql`
      ALTER TABLE trades
        ALTER COLUMN close_pnl TYPE DECIMAL(15, 4),
        ALTER COLUMN upnl_pct TYPE DECIMAL(15, 4),
        ALTER COLUMN volatility TYPE DECIMAL(15, 4),
        ALTER COLUMN half_life TYPE DECIMAL(15, 4),
        ALTER COLUMN sharpe TYPE DECIMAL(15, 4);
    `;

    console.log('[MIGRATION] ✅ Successfully updated trades table columns to DECIMAL(15, 4)');
    console.log('[MIGRATION] These columns can now hold values up to ±99,999,999,999.9999');
    console.log('[MIGRATION] This handles leverage up to 100x without overflow');
  } catch (error) {
    if (error.message?.includes('does not exist')) {
      console.log('[MIGRATION] ⚠️ Table does not exist yet - will be created with correct schema');
    } else {
      console.error('[MIGRATION] ❌ Migration failed:', error);
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error('[MIGRATION] Unhandled error:', err);
  process.exit(1);
});
