/**
 * Update UPnL % for all open trades using latest prices
 * @param getLatestPrice - function(symbol: string) => number
 */
export function updateUPnLForOpenTrades(getLatestPrice: (symbol: string) => number): void {
  for (const trade of tradeHistory) {
    if (trade.longPrice !== undefined && trade.shortPrice !== undefined) {
      // Get current prices for each leg
      const currentLong = getLatestPrice(trade.action === 'long' ? trade.symbolA : trade.symbolB);
      const currentShort = getLatestPrice(trade.action === 'long' ? trade.symbolB : trade.symbolA);
      // Calculate PnL for each leg
      const longRet = (currentLong - trade.longPrice) / trade.longPrice;
      const shortRet = (trade.shortPrice - currentShort) / trade.shortPrice;
      // Pair trading PnL is longRet + shortRet
      trade.upnlPct = ((longRet + shortRet) * 100);
    }
  }
}
// Copilot: Create a function to simulate a trade and log results to console

import { AnalysisResult } from './pair_analysis.js';

/**
 * Interface for a trade execution record
 */
export interface TradeRecord {
  timestamp: number;
  pair: string;
  symbolA: string;
  symbolB: string;
  action: 'long' | 'short' | 'close';
  zScore: number;
  correlation: number;
  spread: number;
  beta: number;
  reason: string;
  priceA?: number;
  priceB?: number;
  longPrice?: number;
  shortPrice?: number;
  upnlPct?: number;
  entryPriceA?: number;
  entryPriceB?: number;
  volatility?: number; // use std of spread as pair volatility proxy
  timeframe?: string;
  engine?: string;
  remarks?: string;
  status?: 'open' | 'closed';
  closeTimestamp?: number;
  closeReason?: string;
  closePnL?: number;
}

/**
 * Simple in-memory trade log
 */
const tradeHistory: TradeRecord[] = [];

/**
 * Load existing trades from file on startup
 * @param filepath - Path to trades file
 * @returns Number of trades loaded
 */
export async function loadTradeHistory(filepath: string = './trades.json'): Promise<number> {
  try {
    const fs = await import('fs/promises');
    const data = await fs.readFile(filepath, 'utf-8');
    const loadedTrades = JSON.parse(data) as TradeRecord[];
    
    // Clear existing and load from file
    tradeHistory.length = 0;
    tradeHistory.push(...loadedTrades);
    
    const openTrades = loadedTrades.filter(t => t.status === 'open');
    console.log(`[EXECUTOR] Loaded ${loadedTrades.length} trade(s) from ${filepath}`);
    console.log(`[EXECUTOR] Found ${openTrades.length} open position(s) to track`);
    
    return loadedTrades.length;
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      console.log(`[EXECUTOR] No existing trade history found at ${filepath}`);
    } else {
      console.error(`[EXECUTOR] Failed to load trade history:`, error);
    }
    return 0;
  }
}

/**
 * Simulate a pair trade execution
 * In production, integrate with ethers.js or exchange API
 * 
 * @param symbolA - First trading symbol
 * @param symbolB - Second trading symbol
 * @param result - Analysis results
 * @param priceA - Current price of symbol A
 * @param priceB - Current price of symbol B
 * @returns Trade record
 */
export function executeTrade(
  symbolA: string,
  symbolB: string,
  result: AnalysisResult,
  priceA: number,
  priceB: number
): TradeRecord | null {
  // Don't execute if signal is neutral
  if (result.signalType === 'neutral') {
    console.log(`[EXECUTOR] No trade: ${symbolA}/${symbolB} signal is neutral`);
    return null;
  }
  
  // Build reason string
  let reason = '';
  if (result.signalType === 'long') {
    reason = `Spread ${result.zScore.toFixed(2)}σ below mean — expecting reversion upward. Long ${symbolA}, short ${symbolB}.`;
  } else if (result.signalType === 'short') {
    reason = `Spread ${result.zScore.toFixed(2)}σ above mean — expecting reversion downward. Short ${symbolA}, long ${symbolB}.`;
  }
  
  // Determine long/short prices for pair trading
  let longPrice: number | undefined = undefined;
  let shortPrice: number | undefined = undefined;
  if (result.signalType === 'long') {
    longPrice = priceA;
    shortPrice = priceB;
  } else if (result.signalType === 'short') {
    longPrice = priceB;
    shortPrice = priceA;
  }

  // Compute initial UPnL % (always 0 at entry)
  let upnlPct: number | undefined = undefined;
  if (longPrice !== undefined && shortPrice !== undefined) {
    upnlPct = 0;
  }

  // Create trade record
  const trade: TradeRecord = {
    timestamp: Date.now(),
    pair: `${symbolA}/${symbolB}`,
    symbolA,
    symbolB,
    action: result.signalType,
    zScore: result.zScore,
    correlation: result.corr,
    spread: result.spread,
    beta: result.beta,
    reason,
    priceA,
    priceB,
    longPrice,
    shortPrice,
    upnlPct,
    // enrich with entry prices and volatility
    entryPriceA: priceA,
    entryPriceB: priceB,
    volatility: result.std,
    timeframe: '1h',
    engine: 'pair-agent v1.0',
    remarks: '-',
    status: 'open', // Trade starts as open
  };
  
  // Log trade execution
  console.log(`
╔═══════════════════════════════════════════╗
║         TRADE EXECUTED (SIMULATED)        ║
╚═══════════════════════════════════════════╝
  Time:     ${new Date(trade.timestamp).toISOString()}
  Pair:     ${trade.pair}
  Action:   ${trade.action === 'short' ? `SHORT ${symbolA}, LONG ${symbolB}` : trade.action === 'long' ? `LONG ${symbolA}, SHORT ${symbolB}` : trade.action.toUpperCase()}
  Z-Score:  ${trade.zScore.toFixed(2)}
  Corr:     ${trade.correlation.toFixed(2)}
  ─────────────────────────────────────────────
  ${symbolA}: $${priceA.toFixed(2)}
  ${symbolB}: $${priceB.toFixed(2)}
  ─────────────────────────────────────────────
  Reason: ${reason}
╔═══════════════════════════════════════════╗
`);
  
  // Store in history
  tradeHistory.push(trade);
  
  return trade;
}

/**
 * Get trade history
 * @returns Array of all executed trades
 */
export function getTradeHistory(): TradeRecord[] {
  return [...tradeHistory];
}

/**
 * Export trade history to JSON
 * @returns JSON string of trade history
 */
export function exportTradeHistory(): string {
  return JSON.stringify(tradeHistory, null, 2);
}

/**
 * Save trade history to a file
 * @param filepath - Path to save file
 */
export async function saveTradeHistory(filepath: string = './trades.json'): Promise<void> {
  try {
    const fs = await import('fs/promises');
    const data = exportTradeHistory();
    await fs.writeFile(filepath, data, 'utf-8');
    console.log(`[EXECUTOR] Trade history saved to ${filepath}`);
  } catch (error) {
    console.error(`[EXECUTOR] Failed to save trade history:`, error);
  }
}

/**
 * Clear trade history
 */
export function clearTradeHistory(): void {
  tradeHistory.length = 0;
  console.log('[EXECUTOR] Trade history cleared');
}

/**
 * Get summary statistics of trade history
 * @returns Summary object
 */
export function getTradeSummary(): {
  totalTrades: number;
  longTrades: number;
  shortTrades: number;
  avgZScore: number;
  avgCorrelation: number;
} {
  if (tradeHistory.length === 0) {
    return {
      totalTrades: 0,
      longTrades: 0,
      shortTrades: 0,
      avgZScore: 0,
      avgCorrelation: 0,
    };
  }
  
  const longTrades = tradeHistory.filter((t) => t.action === 'long').length;
  const shortTrades = tradeHistory.filter((t) => t.action === 'short').length;
  
  const avgZScore =
    tradeHistory.reduce((sum, t) => sum + Math.abs(t.zScore), 0) /
    tradeHistory.length;
    
  const avgCorrelation =
    tradeHistory.reduce((sum, t) => sum + t.correlation, 0) /
    tradeHistory.length;
  
  return {
    totalTrades: tradeHistory.length,
    longTrades,
    shortTrades,
    avgZScore,
    avgCorrelation,
  };
}

/**
 * Exit conditions configuration
 */
export interface ExitConditions {
  meanReversionThreshold: number; // Close when |z-score| < this value (e.g., 0.5)
  stopLossPct: number; // Close if loss exceeds this % (e.g., -5)
  takeProfitPct: number; // Close if profit exceeds this % (e.g., 3)
  maxHoldingPeriodMs: number; // Close after this many ms (e.g., 7 days)
}

/**
 * Default exit conditions
 */
export const DEFAULT_EXIT_CONDITIONS: ExitConditions = {
  meanReversionThreshold: 0.5,
  stopLossPct: -5,
  takeProfitPct: 3,
  maxHoldingPeriodMs: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * Close a trade
 * @param trade - Trade to close
 * @param reason - Reason for closing
 * @param currentPriceA - Current price of symbol A
 * @param currentPriceB - Current price of symbol B
 */
export function closeTrade(
  trade: TradeRecord,
  reason: string,
  currentPriceA: number,
  currentPriceB: number
): void {
  if (trade.status === 'closed') {
    console.log(`[EXECUTOR] Trade ${trade.pair} is already closed`);
    return;
  }

  trade.status = 'closed';
  trade.closeTimestamp = Date.now();
  trade.closeReason = reason;
  trade.closePnL = trade.upnlPct ?? 0;

  console.log(`
╔═══════════════════════════════════════════╗
║          TRADE CLOSED (SIMULATED)         ║
╚═══════════════════════════════════════════╝
  Time:     ${new Date(trade.closeTimestamp).toISOString()}
  Pair:     ${trade.pair}
  Action:   ${trade.action.toUpperCase()}
  Duration: ${((trade.closeTimestamp - trade.timestamp) / 1000 / 60).toFixed(2)} minutes
  ─────────────────────────────────────────────
  Entry ${trade.symbolA}: $${trade.entryPriceA?.toFixed(2) ?? 'N/A'}
  Exit ${trade.symbolA}:  $${currentPriceA.toFixed(2)}
  Entry ${trade.symbolB}: $${trade.entryPriceB?.toFixed(2) ?? 'N/A'}
  Exit ${trade.symbolB}:  $${currentPriceB.toFixed(2)}
  ─────────────────────────────────────────────
  PnL:      ${trade.closePnL >= 0 ? '+' : ''}${trade.closePnL.toFixed(2)}%
  Reason:   ${reason}
╔═══════════════════════════════════════════╗
`);
}

/**
 * Check exit conditions for all open trades
 * @param getLatestPrice - function(symbol: string) => number
 * @param getCurrentZScore - function(symbolA: string, symbolB: string) => Promise<number | null>
 * @param conditions - Exit conditions configuration
 */
export async function checkExitConditions(
  getLatestPrice: (symbol: string) => number,
  getCurrentZScore: (symbolA: string, symbolB: string) => Promise<number | null>,
  conditions: ExitConditions = DEFAULT_EXIT_CONDITIONS
): Promise<void> {
  const openTrades = tradeHistory.filter((t) => t.status === 'open');

  console.log(`[EXIT_CHECK] Checking ${openTrades.length} open trade(s) for exit conditions...`);

  for (const trade of openTrades) {
    const currentPriceA = getLatestPrice(trade.symbolA);
    const currentPriceB = getLatestPrice(trade.symbolB);

    if (currentPriceA === 0 || currentPriceB === 0) {
      console.log(`[EXIT_CHECK] Skipping ${trade.pair} - price data unavailable`);
      continue;
    }

    // Calculate current UPnL
    const longPrice = trade.longPrice ?? 0;
    const shortPrice = trade.shortPrice ?? 0;
    const currentLong = trade.action === 'long' ? currentPriceA : currentPriceB;
    const currentShort = trade.action === 'long' ? currentPriceB : currentPriceA;
    const longRet = longPrice > 0 ? (currentLong - longPrice) / longPrice : 0;
    const shortRet = shortPrice > 0 ? (shortPrice - currentShort) / shortPrice : 0;
    const currentPnLPct = (longRet + shortRet) * 100;

    // Update UPnL
    trade.upnlPct = currentPnLPct;

    // Check 1: Stop Loss
    if (currentPnLPct <= conditions.stopLossPct) {
      closeTrade(
        trade,
        `Stop-loss triggered at ${currentPnLPct.toFixed(2)}%`,
        currentPriceA,
        currentPriceB
      );
      continue;
    }

    // Check 2: Take Profit
    if (currentPnLPct >= conditions.takeProfitPct) {
      closeTrade(
        trade,
        `Take-profit triggered at ${currentPnLPct.toFixed(2)}%`,
        currentPriceA,
        currentPriceB
      );
      continue;
    }

    // Check 3: Max Holding Period
    const holdingTime = Date.now() - trade.timestamp;
    if (holdingTime >= conditions.maxHoldingPeriodMs) {
      closeTrade(
        trade,
        `Max holding period exceeded (${(holdingTime / 1000 / 60 / 60 / 24).toFixed(1)} days)`,
        currentPriceA,
        currentPriceB
      );
      continue;
    }

    // Check 4: Mean Reversion (z-score returns to near 0)
    const currentZScore = await getCurrentZScore(trade.symbolA, trade.symbolB);
    if (currentZScore !== null && Math.abs(currentZScore) <= conditions.meanReversionThreshold) {
      closeTrade(
        trade,
        `Mean reversion complete (z-score: ${currentZScore.toFixed(2)})`,
        currentPriceA,
        currentPriceB
      );
      continue;
    }

    console.log(`[EXIT_CHECK] ${trade.pair} remains open - PnL: ${currentPnLPct.toFixed(2)}%, Z: ${currentZScore?.toFixed(2) ?? 'N/A'}`);
  }
}

/**
 * Get all open trades
 * @returns Array of open trades
 */
export function getOpenTrades(): TradeRecord[] {
  return tradeHistory.filter((t) => t.status === 'open');
}

/**
 * Get all closed trades
 * @returns Array of closed trades
 */
export function getClosedTrades(): TradeRecord[] {
  return tradeHistory.filter((t) => t.status === 'closed');
}

