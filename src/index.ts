// Copilot: Add a loop to run analysis every 1 hour using setInterval

import 'dotenv/config';
import { readFile } from 'fs/promises';
import { fetchPairData, withRetry, fetchMultiplePrices } from './fetcher.js';
import { analyzePair, meetsTradeSignalCriteria } from './pair_analysis.js';
import { formatAnalysisReport } from './narrative.js';
import { 
  executeTrade, 
  saveTradeHistory, 
  getTradeSummary, 
  updateUPnLForOpenTrades,
  checkExitConditions,
  getOpenTrades,
  DEFAULT_EXIT_CONDITIONS,
  loadTradeHistory,
  getTradeHistory
} from './executor.js';
import { generateRandomPairCombinations } from './pair_selector.js';
import { 
  calculatePerformanceMetrics, 
  formatPerformanceReport,
  savePerformanceMetrics 
} from './performance.js';

/**
 * Configuration interface matching eliza.config.json
 */
interface Config {
  agent: {
    name: string;
    description: string;
    version: string;
  };
  pairs: Array<{
    pairA: string;
    pairB: string;
    description: string;
  }>;
  analysis: {
    lookbackPeriod: number;
    updateInterval: number;
    zScoreThreshold: number;
    correlationThreshold: number;
    randomPairCount?: number;
  };
  exitConditions?: {
    meanReversionThreshold: number;
    stopLossPct: number;
    takeProfitPct: number;
    maxHoldingPeriodDays: number;
  };
  apis: {
    binance: {
      baseUrl: string;
      interval: string;
    };
  };
}

/**
 * Load configuration from eliza.config.json
 */
async function loadConfig(): Promise<Config> {
  try {
    const configData = await readFile('./eliza.config.json', 'utf-8');
    return JSON.parse(configData) as Config;
  } catch (error) {
    console.error('[ERROR] Failed to load config:', error);
    throw new Error('Could not load eliza.config.json');
  }
}

/**
 * Analyze a single pair and return whether a trade signal was found
 */
async function analyzeSinglePair(
  pairA: string,
  pairB: string,
  config: Config
): Promise<boolean> {
  console.log(`\n[${new Date().toISOString()}] Analyzing ${pairA}/${pairB}...`);
  
  try {
    // Fetch data with retry
    const { dataA, dataB } = await withRetry(
      () => fetchPairData(pairA, pairB, config.analysis.lookbackPeriod),
      3,
      1000
    );
    
    console.log(`[DATA] Fetched ${dataA.prices.length} data points for each pair`);
    
    // Analyze pair
    const result = analyzePair(dataA.prices, dataB.prices);
    
    // Display formatted report
    console.log(formatAnalysisReport(pairA, pairB, result, { timeframe: '1h' }));
    
    // Check if meets trade criteria
    const shouldTrade = meetsTradeSignalCriteria(
      result,
      config.analysis.zScoreThreshold,
      config.analysis.correlationThreshold
    );
    
    if (shouldTrade) {
      console.log(`[SIGNAL] ⚡ Trade signal detected!`);
      
      // Execute simulated trade
      const currentPriceA = dataA.prices[dataA.prices.length - 1];
      const currentPriceB = dataB.prices[dataB.prices.length - 1];
      
      await executeTrade(pairA, pairB, result, currentPriceA, currentPriceB);
      return true; // Signal found
    } else {
      console.log(`[SIGNAL] No actionable trade signal for this pair`);
      return false; // No signal
    }
    
  } catch (error) {
    console.error(`[ERROR] Failed to analyze ${pairA}/${pairB}:`, error);
    return false; // Error = no signal
  }
}

/**
 * Run analysis cycles until a trade signal is found
 */
async function runAnalysisCycle(config: Config): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${config.agent.name} - Analysis Cycle`);
  console.log(`  ${new Date().toLocaleString()}`);
  console.log(`${'='.repeat(60)}\n`);
  
  // First, check exit conditions for all open trades
  const openTrades = getOpenTrades();
  if (openTrades.length > 0) {
    console.log(`[EXIT_CHECK] Found ${openTrades.length} open trade(s) to check...\n`);
    
    // Build list of unique symbols in open trades
    const symbolsToFetch = new Set<string>();
    openTrades.forEach(t => {
      symbolsToFetch.add(t.symbolA);
      symbolsToFetch.add(t.symbolB);
    });
    
    // Fetch current prices for all symbols in batch using ticker API
    let latestPriceMap: Record<string, number> = {};
    try {
      latestPriceMap = await withRetry(
        () => fetchMultiplePrices(Array.from(symbolsToFetch)),
        3,
        1000
      );
      console.log(`[EXIT_CHECK] Fetched ${Object.keys(latestPriceMap).length} current prices`);
    } catch (error) {
      console.error(`[ERROR] Failed to fetch current prices for exit check:`, error);
      // Set all prices to 0 as fallback
      symbolsToFetch.forEach(symbol => {
        latestPriceMap[symbol] = 0;
      });
    }
    
    // Helper to get current z-score for a pair
    const getCurrentZScore = async (symbolA: string, symbolB: string): Promise<number | null> => {
      try {
        const { dataA, dataB } = await withRetry(
          () => fetchPairData(symbolA, symbolB, config.analysis.lookbackPeriod),
          3,
          1000
        );
        const result = analyzePair(dataA.prices, dataB.prices);
        return result.zScore;
      } catch (error) {
        return null;
      }
    };
    
    await checkExitConditions(
      (symbol) => latestPriceMap[symbol] ?? 0,
      getCurrentZScore,
      config.exitConditions ? {
        meanReversionThreshold: config.exitConditions.meanReversionThreshold,
        stopLossPct: config.exitConditions.stopLossPct,
        takeProfitPct: config.exitConditions.takeProfitPct,
        maxHoldingPeriodMs: config.exitConditions.maxHoldingPeriodDays * 24 * 60 * 60 * 1000,
      } : DEFAULT_EXIT_CONDITIONS
    );
    
    // Show remaining open trades after exit check
    const remainingOpenTrades = getOpenTrades();
    console.log(`\n[EXIT_CHECK] Complete. ${remainingOpenTrades.length} position(s) remain open\n`);
  }
  
  let signalFound = false;
  let scanCount = 0;
  
  // Keep scanning until a trade signal is found
  while (!signalFound) {
    scanCount++;
    
    // Generate random pairs from Binance
    console.log(`[PAIR_SELECTOR] Scan #${scanCount} - Generating random trading pairs...`);
    const pairCount = config.analysis.randomPairCount ?? 3;
    const randomPairs = await generateRandomPairCombinations(pairCount);
    
    console.log(`[PAIR_SELECTOR] Selected ${randomPairs.length} random pairs for this scan\n`);
    
    // Analyze each pair sequentially
    for (const pair of randomPairs) {
      const hasSignal = await analyzeSinglePair(pair.pairA, pair.pairB, config);
      if (hasSignal) {
        signalFound = true;
        console.log(`\n[SUCCESS] ✅ Trade signal found after ${scanCount} scan(s)!`);
        break; // Exit the for loop
      }
    }
    
    if (!signalFound) {
      console.log(`\n[SCAN] No signals found in scan #${scanCount}. Generating new random pairs...\n`);
      // Small delay to avoid hammering the API
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Update UPnL for all open trades using latest prices from the last analyzed pairs
  console.log('\n[UPDATE] Refreshing UPnL for open trades...');
  const latestPriceMap: Record<string, number> = {};
  const pairCount = config.analysis.randomPairCount ?? 3;
  const randomPairs = await generateRandomPairCombinations(pairCount);
  for (const pair of randomPairs) {
    try {
      const { dataA, dataB } = await withRetry(
        () => fetchPairData(pair.pairA, pair.pairB, config.analysis.lookbackPeriod),
        3,
        1000
      );
      latestPriceMap[pair.pairA] = dataA.prices[dataA.prices.length - 1];
      latestPriceMap[pair.pairB] = dataB.prices[dataB.prices.length - 1];
    } catch (error) {
      // Skip on error
    }
  }
  await updateUPnLForOpenTrades((symbol) => latestPriceMap[symbol] ?? 0);

  // Display trade summary
  const summary = getTradeSummary();
  const currentOpenTrades = getOpenTrades();
  
  console.log(`\n[SUMMARY] Trades executed: ${summary.totalTrades} (${summary.longTrades} long, ${summary.shortTrades} short)`);
  console.log(`[SUMMARY] Open trades: ${currentOpenTrades.length}`);
  
  // Display details of open trades
  if (currentOpenTrades.length > 0) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  OPEN POSITIONS`);
    console.log(`${'─'.repeat(60)}`);
    
    currentOpenTrades.forEach((trade, index) => {
      const duration = ((Date.now() - trade.timestamp) / 1000 / 60).toFixed(0);
      const pnlColor = (trade.upnlPct ?? 0) >= 0 ? '+' : '';
      
      console.log(`
  [${index + 1}] ${trade.pair}
    Action:     ${trade.action.toUpperCase()}
    Entry:      ${new Date(trade.timestamp).toLocaleString()}
    Duration:   ${duration} minutes
    UPnL:       ${pnlColor}${(trade.upnlPct ?? 0).toFixed(2)}%
    Z-Score:    ${trade.zScore.toFixed(2)}
    Corr:       ${trade.correlation.toFixed(2)}`);
    });
    
    console.log(`${'─'.repeat(60)}\n`);
  }

  // Save trade history
  await saveTradeHistory();

  // Calculate and display performance metrics
  const allTrades = getTradeHistory();
  const performanceMetrics = calculatePerformanceMetrics(allTrades);
  
  if (performanceMetrics.totalTrades > 0) {
    console.log(formatPerformanceReport(performanceMetrics));
    await savePerformanceMetrics(performanceMetrics);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Cycle complete. Next scan in ${config.analysis.updateInterval / 60000} minutes.`);
  console.log(`${'='.repeat(60)}\n`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║           PAIR-AGENT - Autonomous Trading Bot          ║
║                                                           ║
║  Analyzing crypto pairs for mean-reversion opportunities ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);
  
  try {
    // Load configuration
    const config = await loadConfig();
    console.log(`[CONFIG] Loaded: ${config.agent.name} v${config.agent.version}`);
    console.log(`[CONFIG] Mode: Random pair selection from Binance`);
    console.log(`[CONFIG] Random pair count: ${config.analysis.randomPairCount ?? 3} pairs per scan`);
    console.log(`[CONFIG] Update interval: ${config.analysis.updateInterval / 60000} minutes`);
    console.log(`[CONFIG] Z-score threshold: ±${config.analysis.zScoreThreshold}`);
    console.log(`[CONFIG] Correlation threshold: ${config.analysis.correlationThreshold}`);
    
    if (config.exitConditions) {
      console.log(`[CONFIG] Exit conditions:`);
      console.log(`  - Mean reversion: |z-score| < ${config.exitConditions.meanReversionThreshold}`);
      console.log(`  - Stop loss: ${config.exitConditions.stopLossPct}%`);
      console.log(`  - Take profit: ${config.exitConditions.takeProfitPct}%`);
      console.log(`  - Max holding: ${config.exitConditions.maxHoldingPeriodDays} days`);
    }
    
    // Load existing trade history
    console.log('');
    await loadTradeHistory('./trades.json');
    
    // Display performance metrics at startup
    const allTradesAtStartup = getTradeHistory();
    if (allTradesAtStartup.length > 0) {
      const startupMetrics = calculatePerformanceMetrics(allTradesAtStartup);
      if (startupMetrics.totalTrades > 0) {
        console.log(formatPerformanceReport(startupMetrics));
      }
    }
    
    // Display open trades at startup
    const startupOpenTrades = getOpenTrades();
    if (startupOpenTrades.length > 0) {
      console.log(`\n${'═'.repeat(60)}`);
      console.log(`  📊 EXISTING OPEN POSITIONS`);
      console.log(`${'═'.repeat(60)}`);
      
      startupOpenTrades.forEach((trade, index) => {
        const duration = ((Date.now() - trade.timestamp) / 1000 / 60 / 60).toFixed(1);
        const pnlColor = (trade.upnlPct ?? 0) >= 0 ? '+' : '';
        
        console.log(`
  [${index + 1}] ${trade.pair}
    Action:     ${trade.action.toUpperCase()}
    Entry:      ${new Date(trade.timestamp).toLocaleString()}
    Duration:   ${duration} hours
    Entry PnL:  ${pnlColor}${(trade.upnlPct ?? 0).toFixed(2)}%
    Z-Score:    ${trade.zScore.toFixed(2)}
    Corr:       ${trade.correlation.toFixed(2)}`);
      });
      
      console.log(`${'═'.repeat(60)}\n`);
    }
    
    // Run first cycle immediately
    await runAnalysisCycle(config);
    
    // Schedule periodic execution
    setInterval(async () => {
      try {
        await runAnalysisCycle(config);
      } catch (error) {
        console.error('[ERROR] Analysis cycle failed:', error);
      }
    }, config.analysis.updateInterval);
    
    console.log(`[AGENT] Running continuously. Press Ctrl+C to stop.`);
    
  } catch (error) {
    console.error('[FATAL] Agent startup failed:', error);
    process.exit(1);
  }
}

// Start the agent
main().catch((error) => {
  console.error('[FATAL] Unhandled error:', error);
  process.exit(1);
});
