// Copilot: Add a loop to run analysis every 1 hour using setInterval

import 'dotenv/config';
import { readFile } from 'fs/promises';
import { fetchPairData, withRetry, fetchCurrentPrice, fetchCurrentPriceBySymbol } from './fetcher.js';
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
import { generateRandomPairCombinations, getMarketIndex } from './pair_selector.js';
import { buildSymbolToIndexMap } from './market_cache.js';
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
    exitCheckInterval?: number; // 🆕 Separate interval for exit monitoring (default: 5 minutes)
    maxScansPerCycle?: number;   // 🆕 Cap on scan iterations per cycle to avoid infinite loops
    scanDelayMs?: number;         // 🆕 Delay between pair scans to avoid API rate limits (default: 3000ms)
    predefinedFallbackPairs?: string[]; // 🆕 Fallback pairs to test when maxScans reached without signal
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
  riskManagement?: {
    maxConcurrentTrades: number;
    maxCorrelatedTrades: number;
    maxPortfolioRisk: number;
    minCashReserve: number;
    defaultLeverage: number;
    maxLeverage: number;
  };
  apis: {
    drift: {
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
  marketIndexA: number,
  marketIndexB: number,
  symbolA: string,
  symbolB: string,
  config: Config
): Promise<boolean> {
  console.log(`\n[${new Date().toISOString()}] Analyzing ${symbolA}/${symbolB}...`);

  try {
    // Fetch data with retry
    const { dataA, dataB } = await withRetry(
      () => fetchPairData(marketIndexA, marketIndexB, symbolA, symbolB, config.analysis.lookbackPeriod),
      3,
      1000
    );

    console.log(`[DATA] Fetched ${dataA.prices.length} data points for each pair`);

    // Analyze pair
    const result = analyzePair(dataA.prices, dataB.prices);

    // Display formatted report
    console.log(formatAnalysisReport(symbolA, symbolB, result, { timeframe: '1h' }));

    // Check if meets trade criteria and has a directional signal
    const meetsCriteria = meetsTradeSignalCriteria(
      result,
      config.analysis.zScoreThreshold,
      config.analysis.correlationThreshold
    );

    const hasDirectionalSignal = result.signalType !== 'neutral';

    if (meetsCriteria && hasDirectionalSignal) {
      console.log(`[SIGNAL] ⚡ Trade signal detected! (criteria OK, signal: ${result.signalType.toUpperCase()})`);
    } else if (meetsCriteria && !hasDirectionalSignal) {
      console.log(`[SIGNAL] ⚠ Criteria met but signalType is NEUTRAL (z=${result.zScore.toFixed(2)}, corr=${result.corr.toFixed(3)})`);
    } else if (!meetsCriteria && hasDirectionalSignal) {
      console.log(`[SIGNAL] ⚠ Directional signal (${result.signalType}) present but quality filters failed (z=${result.zScore.toFixed(2)}, corr=${result.corr.toFixed(3)})`);
    }

    // If criteria meet but signalType is neutral (due to default ±2 bands), align
    // direction with the configured threshold using z-score sign.
    if (meetsCriteria && !hasDirectionalSignal) {
      // Mutate result locally so downstream (executeTrade) gets a direction
      (result as any).signalType = result.zScore > 0 ? 'short' : 'long';
    }

    const shouldTrade = meetsCriteria && ((result as any).signalType !== 'neutral');

    if (shouldTrade) {

      // Check risk management limits before executing
      const openTrades = getOpenTrades();
      const maxTrades = config.riskManagement?.maxConcurrentTrades ?? 5;

      if (openTrades.length >= maxTrades) {
        console.log(`[RISK] ⚠️ Max concurrent trades reached (${openTrades.length}/${maxTrades}). Skipping trade.`);
        return false;
      }

      // Check if we already have a correlated trade open
      const maxCorrelated = config.riskManagement?.maxCorrelatedTrades ?? 2;
      const correlatedCount = openTrades.filter(t =>
        t.symbolA === symbolA || t.symbolB === symbolB ||
        t.symbolA === symbolB || t.symbolB === symbolA
      ).length;

      if (correlatedCount >= maxCorrelated) {
        console.log(`[RISK] ⚠️ Too many correlated trades (${correlatedCount}/${maxCorrelated}). Skipping ${symbolA}/${symbolB}.`);
        return false;
      }

      // Execute simulated trade
      const currentPriceA = dataA.prices[dataA.prices.length - 1];
      const currentPriceB = dataB.prices[dataB.prices.length - 1];

      const trade = await executeTrade(symbolA, symbolB, result, currentPriceA, currentPriceB);
      
      // Update performance metrics immediately after trade execution
      if (trade) {
        const allTrades = getTradeHistory();
        const openTradesCount = getOpenTrades().length;
        const performanceMetrics = calculatePerformanceMetrics(allTrades);
        if (performanceMetrics.totalTrades > 0) {
          console.log(`[SIGNAL] Updating performance metrics after new trade...`);
          await savePerformanceMetrics(performanceMetrics, openTradesCount);
        }
      }
      
      return true; // Signal found
    } else {
      console.log(`[SIGNAL] No actionable trade signal for this pair`);
      return false; // No signal
    }

  } catch (error: any) {
    // If this is a client/no-data error from the Data API (e.g., 403 forbidden, no TWAP),
    // treat it as a soft skip rather than a hard failure.
    const clientErr = error && (error as any).isClientError === true;
    const noDataErr = error && (error as any).isNoData === true;

    if (clientErr || noDataErr) {
      console.warn(`[SKIP] Skipping pair ${symbolA}/${symbolB} due to missing TWAP or client error: ${error.message}`);
      return false;
    }

    console.error(`[ERROR] Failed to analyze ${symbolA}/${symbolB}:`, error);
    return false; // Error = no signal
  }
}

/**
 * Perform quick exit condition check for all open trades
 * Lightweight version for frequent monitoring (every 5 minutes)
 */
async function performQuickExitCheck(config: Config): Promise<number> {
  const openTrades = getOpenTrades();

  if (openTrades.length === 0) {
    return 0;
  }

  const initialCount = openTrades.length;
  console.log(`\n[EXIT_MONITOR] 🔍 Quick check: ${openTrades.length} open position(s) at ${new Date().toLocaleTimeString()}`);

  // Build list of unique symbols in open trades
  const symbolsToFetch = new Set<string>();
  openTrades.forEach(t => {
    symbolsToFetch.add(t.symbolA);
    symbolsToFetch.add(t.symbolB);
  });

  // Fetch current prices for all symbols
  let latestPriceMap: Record<string, number> = {};
  try {
    for (const symbol of symbolsToFetch) {
      try {
        const marketIndex = await getMarketIndex(symbol);
        if (marketIndex !== undefined) {
          const price = await fetchCurrentPrice(marketIndex, symbol);
          latestPriceMap[symbol] = price;
        } else {
          latestPriceMap[symbol] = 0;
        }
      } catch (err: any) {
        console.error(`[EXIT_MONITOR] Failed to fetch ${symbol}: ${err.message}`);
        latestPriceMap[symbol] = 0;
      }
    }
  } catch (error) {
    console.error(`[EXIT_MONITOR] Price fetch error:`, error);
    return 0;
  }

  // Helper to get current z-score for a pair
  const getCurrentZScore = async (symbolA: string, symbolB: string): Promise<number | null> => {
    try {
      const indexA = await getMarketIndex(symbolA);
      const indexB = await getMarketIndex(symbolB);

      if (indexA === undefined || indexB === undefined) {
        return null;
      }

      const { dataA, dataB } = await withRetry(
        () => fetchPairData(indexA, indexB, symbolA, symbolB, 100),
        2,
        1000
      );

      const analysis = analyzePair(dataA.prices, dataB.prices);
      return analysis.zScore;
    } catch (error: any) {
      console.error(`[EXIT_MONITOR] Z-score calc failed for ${symbolA}/${symbolB}: ${error.message}`);
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

  const remainingTrades = getOpenTrades();
  const closedCount = initialCount - remainingTrades.length;

  if (closedCount > 0) {
    console.log(`[EXIT_MONITOR] ⚠️ CLOSED ${closedCount} position(s)! ${remainingTrades.length} remain.`);
    
    // Update performance metrics when trades are closed
    const allTrades = getTradeHistory();
    const openTradesCount = remainingTrades.length;
    const performanceMetrics = calculatePerformanceMetrics(allTrades);
    if (performanceMetrics.totalTrades > 0) {
      console.log(`[EXIT_MONITOR] Updating performance metrics...`);
      await savePerformanceMetrics(performanceMetrics, openTradesCount);
    }
  } else {
    console.log(`[EXIT_MONITOR] ✅ All positions within limits. ${remainingTrades.length} still open.`);
  }

  return closedCount;
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
    const initialOpenCount = openTrades.length;
    console.log(`[EXIT_CHECK] Found ${openTrades.length} open trade(s) to check...\n`);

    // Build list of unique symbols in open trades
    // NOTE: We need to fetch market info to get indices - for now use oracle endpoint per symbol
    const symbolsToFetch = new Set<string>();
    openTrades.forEach(t => {
      symbolsToFetch.add(t.symbolA);
      symbolsToFetch.add(t.symbolB);
    });

    // Build a symbol->index map once to avoid repeated market cache fetches
    let symbolToIndex: Record<string, number> = {};
    try {
      symbolToIndex = await buildSymbolToIndexMap();
    } catch {}

    // Fetch current prices for all symbols using market index mapping
    let latestPriceMap: Record<string, number> = {};
    try {
      console.log(`[EXIT_CHECK] Fetching prices for ${symbolsToFetch.size} symbols...`);

      for (const symbol of symbolsToFetch) {
        try {
          const marketIndex = symbolToIndex[symbol] ?? await getMarketIndex(symbol);
          if (marketIndex !== undefined) {
            const price = await fetchCurrentPrice(marketIndex, symbol);
            latestPriceMap[symbol] = price;
            console.log(`[EXIT_CHECK] ${symbol}: $${price.toFixed(2)}`);
          } else {
            console.warn(`[EXIT_CHECK] Unknown market index for ${symbol} - skipping`);
            latestPriceMap[symbol] = 0;
          }
        } catch (err: any) {
          console.error(`[EXIT_CHECK] Failed to fetch price for ${symbol}: ${err.message}`);
          latestPriceMap[symbol] = 0;
        }
      }

      const fetchedCount = Object.values(latestPriceMap).filter(p => p > 0).length;
      console.log(`[EXIT_CHECK] Successfully fetched ${fetchedCount}/${symbolsToFetch.size} prices`);
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
        const indexA = symbolToIndex[symbolA] ?? await getMarketIndex(symbolA);
        const indexB = symbolToIndex[symbolB] ?? await getMarketIndex(symbolB);

        if (indexA === undefined || indexB === undefined) {
          console.warn(`[EXIT_CHECK] Cannot find market indices for ${symbolA}/${symbolB}`);
          return null;
        }

        // Fetch recent data and compute current z-score
        const { dataA, dataB } = await withRetry(
          () => fetchPairData(indexA, indexB, symbolA, symbolB, 100),
          2,
          1000
        );

        const analysis = analyzePair(dataA.prices, dataB.prices);
        return analysis.zScore;
      } catch (error: any) {
        console.error(`[EXIT_CHECK] Failed to calculate z-score for ${symbolA}/${symbolB}: ${error.message}`);
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
    const closedInCycle = initialOpenCount - remainingOpenTrades.length;
    console.log(`\n[EXIT_CHECK] Complete. ${remainingOpenTrades.length} position(s) remain open\n`);
    
    // Update performance metrics if any trades were closed
    if (closedInCycle > 0) {
      const allTrades = getTradeHistory();
      const performanceMetrics = calculatePerformanceMetrics(allTrades);
      if (performanceMetrics.totalTrades > 0) {
        console.log(`[EXIT_CHECK] Updating performance metrics after closing ${closedInCycle} trade(s)...`);
        await savePerformanceMetrics(performanceMetrics, remainingOpenTrades.length);
      }
    }
  }

  let signalFound = false;
  let scanCount = 0;
  const maxScans = config.analysis.maxScansPerCycle ?? 20;
  const maxTrades = config.riskManagement?.maxConcurrentTrades ?? 5;

  // Keep scanning until a trade signal is found
  while (!signalFound) {
    // Check if max concurrent trades already reached - stop scanning
    const currentOpenTrades = getOpenTrades();
    if (currentOpenTrades.length >= maxTrades) {
      console.log(`\n[SCAN] ⚠️ Max concurrent trades already reached (${currentOpenTrades.length}/${maxTrades}). Stopping scan.`);
      break;
    }

    scanCount++;

    // Generate random pairs from Drift Protocol
    console.log(`[PAIR_SELECTOR] Scan #${scanCount} - Generating random trading pairs...`);
    const pairCount = config.analysis.randomPairCount ?? 3;
    const randomPairs = await generateRandomPairCombinations(pairCount);

    console.log(`[PAIR_SELECTOR] Selected ${randomPairs.length} random pairs for this scan\n`);

    // Analyze each pair sequentially
    for (const pair of randomPairs) {
      const hasSignal = await analyzeSinglePair(
        pair.marketIndexA,
        pair.marketIndexB,
        pair.symbolA,
        pair.symbolB,
        config
      );
      if (hasSignal) {
        signalFound = true;
        console.log(`\n[SUCCESS] ✅ Trade signal found after ${scanCount} scan(s)!`);
        break; // Exit the for loop
      }
      
      // Add delay between pair scans to avoid API rate limits
      const delayMs = config.analysis.scanDelayMs ?? 3000;
      if (randomPairs.indexOf(pair) < randomPairs.length - 1) { // Don't delay after last pair
        console.log(`[SCAN] Waiting ${delayMs}ms before next pair...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    if (!signalFound) {
      // Reached cap? Try predefined fallback pairs before ending cycle
      if (scanCount >= maxScans) {
        console.log(`\n[SCAN] Reached max scans per cycle (${maxScans}). Testing predefined fallback pairs...`);
        
        const fallbackPairs = config.analysis.predefinedFallbackPairs ?? [];
        if (fallbackPairs.length > 0) {
          console.log(`[FALLBACK] Testing ${fallbackPairs.length} predefined high-correlation pairs:\n  - ${fallbackPairs.join('\n  - ')}\n`);
          
          for (const pairString of fallbackPairs) {
            const [symbolA, symbolB] = pairString.split('/');
            if (!symbolA || !symbolB) {
              console.warn(`[FALLBACK] Invalid pair format: ${pairString}. Skipping.`);
              continue;
            }
            
            try {
              // Get market indices for the pair
              const marketIndexA = await getMarketIndex(symbolA);
              const marketIndexB = await getMarketIndex(symbolB);
              
              if (marketIndexA === undefined || marketIndexB === undefined) {
                console.warn(`[FALLBACK] Market index not found for ${symbolA}/${symbolB}. Skipping.`);
                continue;
              }
              
              const hasSignal = await analyzeSinglePair(
                marketIndexA,
                marketIndexB,
                symbolA,
                symbolB,
                config
              );
              
              if (hasSignal) {
                signalFound = true;
                console.log(`\n[SUCCESS] ✅ Trade signal found in fallback pair ${symbolA}/${symbolB}!`);
                break; // Exit fallback loop
              }
              
              // Delay between fallback pairs
              const delayMs = config.analysis.scanDelayMs ?? 3000;
              if (fallbackPairs.indexOf(pairString) < fallbackPairs.length - 1) {
                console.log(`[FALLBACK] Waiting ${delayMs}ms before next fallback pair...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
              }
            } catch (err: any) {
              console.error(`[FALLBACK] Error analyzing ${symbolA}/${symbolB}: ${err.message}`);
            }
          }
          
          if (!signalFound) {
            console.log(`\n[FALLBACK] No signals found in fallback pairs either. Ending cycle.`);
          }
        } else {
          console.log(`[SCAN] No fallback pairs configured. Ending cycle without a trade.`);
        }
        break;
      }
      console.log(`\n[SCAN] No signals found in scan #${scanCount}. Generating new random pairs...\n`);
      // Delay before next scan cycle to avoid hammering the API
      const delayMs = config.analysis.scanDelayMs ?? 3000;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  // Update UPnL for all open trades using freshest prices for open-trade symbols
  console.log('\n[UPDATE] Refreshing UPnL for open trades...');
  const latestPriceMap: Record<string, number> = {};
  const openForUpdate = getOpenTrades();

  if (openForUpdate.length > 0) {
    // Build symbol set from open trades
    const symbols = new Set<string>();
    openForUpdate.forEach(t => { symbols.add(t.symbolA); symbols.add(t.symbolB); });

    // Try to prebuild symbol->index map once
    let symbolToIndex: Record<string, number> = {};
    try {
      symbolToIndex = await buildSymbolToIndexMap();
    } catch {}

    for (const symbol of symbols) {
      try {
        const marketIndex = symbolToIndex[symbol] ?? await getMarketIndex(symbol);
        if (marketIndex !== undefined) {
          const price = await fetchCurrentPrice(marketIndex, symbol);
          latestPriceMap[symbol] = price;
        } else {
          // Fallback: try fetching by symbol directly (does not require market index)
          const price = await fetchCurrentPriceBySymbol(symbol);
          latestPriceMap[symbol] = price ?? 0;
        }
      } catch (err: any) {
        console.warn(`[UPDATE] Failed to fetch current price for ${symbol}: ${err.message}`);
        latestPriceMap[symbol] = 0;
      }
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
  const openTradesCount = getOpenTrades().length;
  const performanceMetrics = calculatePerformanceMetrics(allTrades);

  if (performanceMetrics.totalTrades > 0) {
    console.log(formatPerformanceReport(performanceMetrics, openTradesCount));
    await savePerformanceMetrics(performanceMetrics, openTradesCount);
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
    console.log(`[CONFIG] Mode: Random pair selection from Drift Protocol`);
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
    await loadTradeHistory();

    // Display performance metrics at startup
    const allTradesAtStartup = getTradeHistory();
    const openTradesAtStartup = getOpenTrades().length;
    if (allTradesAtStartup.length > 0) {
      const startupMetrics = calculatePerformanceMetrics(allTradesAtStartup);
      if (startupMetrics.totalTrades > 0) {
        console.log(formatPerformanceReport(startupMetrics, openTradesAtStartup));
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

    // 🔥 NEW: Schedule frequent exit monitoring (every 5 minutes by default)
    // This runs independently to catch stop-losses quickly
    const EXIT_CHECK_INTERVAL = config.analysis.exitCheckInterval ?? (5 * 60 * 1000); // Default: 5 minutes
    setInterval(async () => {
      try {
        // Only run if there are open trades
        if (getOpenTrades().length > 0) {
          await performQuickExitCheck(config);
        }
      } catch (error) {
        console.error('[ERROR] Exit monitoring failed:', error);
      }
    }, EXIT_CHECK_INTERVAL);

    // Run first cycle immediately
    await runAnalysisCycle(config);

    // Schedule main analysis cycle (hourly by default)
    setInterval(async () => {
      try {
        await runAnalysisCycle(config);
      } catch (error) {
        console.error('[ERROR] Analysis cycle failed:', error);
      }
    }, config.analysis.updateInterval);



    console.log(`[AGENT] Running continuously with:`);
    console.log(`  - Main analysis cycle: Every ${config.analysis.updateInterval / 60000} minutes`);
    console.log(`  - Exit monitoring: Every ${EXIT_CHECK_INTERVAL / 60000} minutes`);
    console.log(`  Press Ctrl+C to stop.\n`);

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
