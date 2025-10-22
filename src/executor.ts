/**
 * Update UPnL % for all open trades using latest prices
 * @param getLatestPrice - function(symbol: string) => number
 */
export async function updateUPnLForOpenTrades(getLatestPrice: (symbol: string) => number): Promise<void> {
  for (const trade of tradeHistory) {
    if (trade.status === 'open' && trade.longPrice !== undefined && trade.shortPrice !== undefined) {
      // Get current prices for each leg
      const currentLong = getLatestPrice(trade.action === 'long' ? trade.symbolA : trade.symbolB);
      const currentShort = getLatestPrice(trade.action === 'long' ? trade.symbolB : trade.symbolA);
      // Calculate PnL for each leg
      const longRet = (currentLong - trade.longPrice) / trade.longPrice;
      const shortRet = (trade.shortPrice - currentShort) / trade.shortPrice;
      // Pair trading PnL is longRet + shortRet
      const newUpnl = (longRet + shortRet) * 100;
      trade.upnlPct = newUpnl;

      // Update in database
      if (trade.id) {
        try {
          await updateTradePnL(trade.id, newUpnl);
        } catch (error) {
          console.error(`[EXECUTOR] Failed to update PnL for trade ${trade.id}:`, error);
        }
      }
    }
  }
}
// Copilot: Create a function to simulate a trade and log results to console

import { AnalysisResult } from './pair_analysis.js';
import {
  insertTrade,
  closeTrade as dbCloseTrade,
  updateTradePnL,
  getAllTrades,
  TradeRecord as DBTradeRecord,
  initializeTables,
} from './db.js';

/**
 * Interface for a trade execution record
 */
export interface TradeRecord {
  id?: number;
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
 * Simple in-memory trade log (kept for backward compatibility and fast access)
 */
const tradeHistory: TradeRecord[] = [];

/**
 * Database initialized flag
 */
let dbInitialized = false;

/**
 * Initialize database connection
 */
async function ensureDbInitialized() {
  if (!dbInitialized) {
    await initializeTables();
    dbInitialized = true;
  }
}

/**
 * Convert DB trade record to local format
 */
function dbTradeToLocal(dbTrade: any): TradeRecord {
  // Parse timestamp
  const timestamp = typeof dbTrade.timestamp === 'string'
    ? new Date(dbTrade.timestamp).getTime()
    : dbTrade.timestamp;
  
  const closeTimestamp = dbTrade.closeTimestamp
    ? typeof dbTrade.closeTimestamp === 'string'
      ? new Date(dbTrade.closeTimestamp).getTime()
      : dbTrade.closeTimestamp
    : undefined;

  // Extract symbolA and symbolB from pair (format: "SYMBOL1/SYMBOL2")
  const [symbolA, symbolB] = dbTrade.pair.split('/');

  return {
    id: dbTrade.id,
    timestamp,
    pair: dbTrade.pair,
    symbolA: symbolA || '',
    symbolB: symbolB || '',
    action: dbTrade.action as 'long' | 'short' | 'close',
    zScore: Number(dbTrade.zScore),
    correlation: Number(dbTrade.correlation),
    spread: Number(dbTrade.spread),
    beta: Number(dbTrade.beta),
    reason: dbTrade.reason,
    priceA: Number(dbTrade.longPrice), // Store longPrice as priceA for now
    priceB: Number(dbTrade.shortPrice),
    longPrice: Number(dbTrade.longPrice),
    shortPrice: Number(dbTrade.shortPrice),
    upnlPct: dbTrade.upnlPct ? Number(dbTrade.upnlPct) : 0,
    entryPriceA: Number(dbTrade.longPrice),
    entryPriceB: Number(dbTrade.shortPrice),
    volatility: dbTrade.volatility ? Number(dbTrade.volatility) : 0,
    timeframe: '1h',
    engine: 'pair-agent v1.0',
    remarks: '-',
    status: dbTrade.status as 'open' | 'closed',
    closeTimestamp,
    closeReason: dbTrade.closeReason,
    closePnL: dbTrade.closePnL ? Number(dbTrade.closePnL) : undefined,
  };
}

/**
 * Load existing trades from database on startup
 * @returns Number of trades loaded
 */
export async function loadTradeHistory(): Promise<number> {
  try {
    await ensureDbInitialized();
    
    // Load all trades from database
    const dbTrades = await getAllTrades();
    
    // Clear existing and load from database
    tradeHistory.length = 0;
    tradeHistory.push(...dbTrades.map(dbTradeToLocal));
    
    const openTrades = tradeHistory.filter(t => t.status === 'open');
    console.log(`[EXECUTOR] Loaded ${tradeHistory.length} trade(s) from database`);
    console.log(`[EXECUTOR] Found ${openTrades.length} open position(s) to track`);
    
    return tradeHistory.length;
  } catch (error) {
    console.error(`[EXECUTOR] Failed to load trade history from database:`, error);
    throw error;
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
export async function executeTrade(
  symbolA: string,
  symbolB: string,
  result: AnalysisResult,
  priceA: number,
  priceB: number
): Promise<TradeRecord | null> {
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

  const timestamp = new Date().toISOString();
  const pair = `${symbolA}/${symbolB}`;

  // Determine signal text
  let signal = '';
  if (result.signalType === 'long') {
    signal = `LONG ${symbolA}, SHORT ${symbolB}`;
  } else if (result.signalType === 'short') {
    signal = `SHORT ${symbolA}, LONG ${symbolB}`;
  }

  // Create database record
  const dbTrade: DBTradeRecord = {
    timestamp,
    pair,
    action: signal,
    signal,
    zScore: result.zScore,
    correlation: result.corr,
    spread: result.spread,
    spreadMean: result.mean,
    spreadStd: result.std,
    beta: result.beta,
    reason,
    longAsset: result.signalType === 'long' ? symbolA : symbolB,
    shortAsset: result.signalType === 'long' ? symbolB : symbolA,
    longPrice: longPrice!,
    shortPrice: shortPrice!,
    status: 'open',
    upnlPct: 0,
    volatility: result.std,
    halfLife: 0,
    sharpe: 0,
  };

  try {
    // Save to database
    await ensureDbInitialized();
    const tradeId = await insertTrade(dbTrade);

    // Create local trade record
    const trade: TradeRecord = {
      id: tradeId,
      timestamp: new Date(timestamp).getTime(),
      pair,
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
      entryPriceA: priceA,
      entryPriceB: priceB,
      volatility: result.std,
      timeframe: '1h',
      engine: 'pair-agent v1.0',
      remarks: '-',
      status: 'open',
    };
    
    // Log trade execution
    console.log(`
╔═══════════════════════════════════════════╗
║         TRADE EXECUTED (SIMULATED)        ║
╚═══════════════════════════════════════════╝
  Time:     ${timestamp}
  Pair:     ${trade.pair}
  Action:   ${signal}
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
  } catch (error) {
    console.error('[EXECUTOR] Failed to save trade to database:', error);
    console.log('[EXECUTOR] Trade not recorded');
    return null;
  }
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
 * Save trade history (deprecated - trades are saved to DB in real-time)
 * Kept for backward compatibility but does nothing
 */
export async function saveTradeHistory(): Promise<void> {
  // No-op: trades are now saved to database in real-time via executeTrade() and closeTrade()
  console.log(`[EXECUTOR] Trade history auto-saved to database`);
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
export async function closeTrade(
  trade: TradeRecord,
  reason: string,
  currentPriceA: number,
  currentPriceB: number
): Promise<void> {
  if (trade.status === 'closed') {
    console.log(`[EXECUTOR] Trade ${trade.pair} is already closed`);
    return;
  }

  const closeTimestamp = new Date().toISOString();
  const closePnL = trade.upnlPct ?? 0;

  // Update in database
  if (trade.id) {
    try {
      await ensureDbInitialized();
      await dbCloseTrade(trade.id, closeTimestamp, reason, closePnL);
    } catch (error) {
      console.error('[EXECUTOR] Failed to update trade in database:', error);
    }
  }

  // Update local record
  trade.status = 'closed';
  trade.closeTimestamp = new Date(closeTimestamp).getTime();
  trade.closeReason = reason;
  trade.closePnL = closePnL;

  console.log(`
╔═══════════════════════════════════════════╗
║          TRADE CLOSED (SIMULATED)         ║
╚═══════════════════════════════════════════╝
  Time:     ${closeTimestamp}
  Pair:     ${trade.pair}
  Action:   ${trade.action.toUpperCase()}
  Duration: ${((trade.closeTimestamp - trade.timestamp) / 1000 / 60).toFixed(2)} minutes
  ─────────────────────────────────────────────
  Entry ${trade.symbolA}: $${trade.entryPriceA?.toFixed(2) ?? 'N/A'}
  Exit ${trade.symbolA}:  $${currentPriceA.toFixed(2)}
  Entry ${trade.symbolB}: $${trade.entryPriceB?.toFixed(2) ?? 'N/A'}
  Exit ${trade.symbolB}:  $${currentPriceB.toFixed(2)}
  ─────────────────────────────────────────────
  PnL:      ${closePnL >= 0 ? '+' : ''}${closePnL.toFixed(2)}%
  Reason:   ${reason}
╔═══════════════════════════════════════════╝
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

