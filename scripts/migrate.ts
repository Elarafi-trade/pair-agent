/**
 * Migration script to import existing trades.json into Neon database
 * Usage: npx tsx scripts/migrate.ts
 */

import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import { insertTrade, initializeTables, getAllTrades } from '../src/db.js';

async function migrate() {
  console.log('🚀 Starting migration to Neon database...\n');

  try {
    // Initialize database tables
    console.log('[1/4] Initializing database tables...');
    await initializeTables();
    console.log('✅ Tables initialized\n');

    // Check if trades.json exists
    const tradesPath = './trades.json';
    if (!existsSync(tradesPath)) {
      console.log(`⚠️  No trades.json found at ${tradesPath}`);
      console.log('Nothing to migrate. Exiting...');
      return;
    }

    // Read existing trades
    console.log(`[2/4] Reading trades from ${tradesPath}...`);
    const data = readFileSync(tradesPath, 'utf-8');
    const trades = JSON.parse(data);
    console.log(`✅ Found ${trades.length} trade(s)\n`);

    if (trades.length === 0) {
      console.log('No trades to migrate. Exiting...');
      return;
    }

    // Check if database already has trades
    console.log('[3/4] Checking existing database records...');
    const existingTrades = await getAllTrades();
    
    if (existingTrades.length > 0) {
      console.log(`⚠️  Database already contains ${existingTrades.length} trade(s)`);
      console.log('Migration aborted to prevent duplicates.');
      console.log('\nTo force migration, manually clear the database first.');
      return;
    }
    console.log('✅ Database is empty, proceeding with migration\n');

    // Migrate each trade
    console.log('[4/4] Migrating trades to database...');
    let successCount = 0;
    let errorCount = 0;

    for (const trade of trades) {
      try {
        // Convert local trade format to database format
        const [symbolA, symbolB] = trade.pair.split('/');
        
        const dbTrade = {
          timestamp: new Date(trade.timestamp).toISOString(),
          pair: trade.pair,
          action: trade.signal || `${trade.action.toUpperCase()} ${symbolA}/${symbolB}`,
          signal: trade.signal || trade.action.toUpperCase(),
          zScore: trade.zScore,
          correlation: trade.correlation,
          spread: trade.spread,
          spreadMean: trade.spreadMean || 0,
          spreadStd: trade.spreadStd || trade.volatility || 0,
          beta: trade.beta,
          reason: trade.reason,
          longAsset: trade.action === 'long' ? symbolA : symbolB,
          shortAsset: trade.action === 'long' ? symbolB : symbolA,
          longPrice: trade.longPrice || trade.priceA || 0,
          shortPrice: trade.shortPrice || trade.priceB || 0,
          status: (trade.status as 'open' | 'closed') || 'open',
          closeTimestamp: trade.closeTimestamp ? new Date(trade.closeTimestamp).toISOString() : undefined,
          closeReason: trade.closeReason,
          closePnL: trade.closePnL,
          upnlPct: trade.upnlPct || 0,
          volatility: trade.volatility || 0,
          halfLife: trade.halfLife || 0,
          sharpe: trade.sharpe || 0,
          cointegrationPValue: trade.cointegrationPValue || 0,
          isCointegrated: trade.isCointegrated || false,
        };

        await insertTrade(dbTrade);
        successCount++;
        process.stdout.write(`\r  Migrated: ${successCount}/${trades.length}`);
      } catch (error) {
        errorCount++;
        console.error(`\n❌ Failed to migrate trade ${trade.pair}:`, error);
      }
    }

    console.log(`\n\n✅ Migration complete!`);
    console.log(`   Success: ${successCount} trade(s)`);
    if (errorCount > 0) {
      console.log(`   Errors:  ${errorCount} trade(s)`);
    }
    console.log('\n📊 You can now start the agent - it will load trades from the database.');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('\nMake sure:');
    console.error('1. DATABASE_URL is set in .env file');
    console.error('2. Neon database is accessible');
    console.error('3. trades.json is valid JSON');
    process.exit(1);
  }
}

// Run migration
migrate();
