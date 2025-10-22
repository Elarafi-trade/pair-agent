import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Please create a .env file with your Neon connection string.');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function main() {
  console.log('[MIGRATION] Updating performance_metrics table schema...');

  try {
    // Alter columns to support larger values
    await sql`
      ALTER TABLE performance_metrics
        ALTER COLUMN total_return_pct TYPE DECIMAL(15, 4),
        ALTER COLUMN total_return_pct_leveraged TYPE DECIMAL(15, 4),
        ALTER COLUMN profit_factor TYPE DECIMAL(15, 4),
        ALTER COLUMN estimated_apy TYPE DECIMAL(15, 4),
        ALTER COLUMN estimated_apy_leveraged TYPE DECIMAL(15, 4);
    `;

    console.log('[MIGRATION] ✅ Successfully updated performance_metrics columns to DECIMAL(15, 4)');
    console.log('[MIGRATION] These columns can now hold values up to ±999,999,999.9999');
  } catch (error) {
    console.error('[MIGRATION] ❌ Migration failed:', error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[MIGRATION] Unhandled error:', err);
  process.exit(1);
});
