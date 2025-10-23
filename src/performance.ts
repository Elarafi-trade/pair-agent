// Agent performance metrics tracking

import { TradeRecord } from './executor.js';
import {
  savePerformanceMetrics as dbSavePerformanceMetrics,
  getPerformanceMetrics as dbGetPerformanceMetrics,
  initializeTables,
} from './db.js';

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number; // Percentage
  totalReturnWithLeverage: number; // Percentage
  totalReturnWithoutLeverage: number; // Percentage
  apy: number; // Annualized Percentage Yield
  avgTradesPerDay: number;
  avgReturnsPerDay: number; // Percentage
  profitFactor: number; // Gross profit / Gross loss
  avgDuration: number; // Hours
  startDate: number; // Timestamp
  lastUpdated: number; // Timestamp
}

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
 * Calculate comprehensive performance metrics from trade history
 * @param trades - Array of all trade records (both open and closed)
 * @returns Performance metrics object
 */
export function calculatePerformanceMetrics(trades: TradeRecord[]): PerformanceMetrics {
  // Filter only closed trades for performance calculation
  const closedTrades = trades.filter(t => t.status === 'closed');
  
  if (closedTrades.length === 0) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalReturnWithLeverage: 0,
      totalReturnWithoutLeverage: 0,
      apy: 0,
      avgTradesPerDay: 0,
      avgReturnsPerDay: 0,
      profitFactor: 0,
      avgDuration: 0,
      startDate: Date.now(),
      lastUpdated: Date.now(),
    };
  }

  // Basic counts
  const totalTrades = closedTrades.length;
  const winningTrades = closedTrades.filter(t => (t.closePnL ?? 0) > 0).length;
  const losingTrades = closedTrades.filter(t => (t.closePnL ?? 0) <= 0).length;
  const winRate = (winningTrades / totalTrades) * 100;

  // Returns calculation (without leverage = sum of PnL %, with leverage from config)
  // Note: Using 2x leverage from eliza.config.json (defaultLeverage: 2)
  const LEVERAGE_MULTIPLIER = 2; // Changed from 10x to match config
  const totalReturnWithoutLeverage = closedTrades.reduce((sum, t) => sum + (t.closePnL ?? 0), 0);
  const totalReturnWithLeverage = totalReturnWithoutLeverage * LEVERAGE_MULTIPLIER;

  // Time-based metrics
  const firstTradeTime = Math.min(...closedTrades.map(t => t.timestamp));
  const lastTradeTime = Math.max(...closedTrades.map(t => t.closeTimestamp ?? t.timestamp));
  const totalDays = (lastTradeTime - firstTradeTime) / (1000 * 60 * 60 * 24);
  const avgTradesPerDay = totalDays > 0 ? totalTrades / totalDays : 0;

  // APY calculation: ((1 + total return)^(365/days) - 1) * 100
  // Cap APY calculation to prevent infinity when time period is very small
  const totalReturnDecimal = totalReturnWithLeverage / 100;
  let apy = 0;
  
  // Require minimum 3 days of data OR 5+ trades to calculate meaningful APY
  // Short time periods create unrealistic extrapolations
  if (totalDays >= 3 || totalTrades >= 5) {
    if (totalDays >= 1) {
      const rawApy = (Math.pow(1 + totalReturnDecimal, 365 / totalDays) - 1) * 100;
      // Cap at ±999,999% to prevent database overflow
      apy = Math.max(-999999, Math.min(999999, rawApy));
      // Set to 0 if result is not finite (Infinity, -Infinity, NaN)
      if (!Number.isFinite(apy)) {
        apy = 0;
      }
    } else {
      // For periods < 1 day, use simple annualized rate without compounding
      apy = totalDays > 0 ? (totalReturnDecimal * (365 / totalDays)) * 100 : 0;
      // Still cap for safety
      apy = Math.max(-999999, Math.min(999999, apy));
      if (!Number.isFinite(apy)) {
        apy = 0;
      }
    }
  } else {
    // Not enough data - set APY to 0 and let it calculate once we have sufficient history
    apy = 0;
  }

  // Average returns per day
  const avgReturnsPerDay = totalDays > 0 ? totalReturnWithoutLeverage / totalDays : 0;

  // Profit Factor: Total profit from winning trades / Total loss from losing trades
  const totalProfit = closedTrades
    .filter(t => (t.closePnL ?? 0) > 0)
    .reduce((sum, t) => sum + (t.closePnL ?? 0), 0);
  const totalLoss = Math.abs(
    closedTrades
      .filter(t => (t.closePnL ?? 0) < 0)
      .reduce((sum, t) => sum + (t.closePnL ?? 0), 0)
  );
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : 0;

  // Average duration (in hours)
  const avgDuration = closedTrades.reduce((sum, t) => {
    const duration = ((t.closeTimestamp ?? Date.now()) - t.timestamp) / (1000 * 60 * 60);
    return sum + duration;
  }, 0) / totalTrades;

  return {
    totalTrades,
    winningTrades,
    losingTrades,
    winRate,
    totalReturnWithLeverage,
    totalReturnWithoutLeverage,
    apy,
    avgTradesPerDay,
    avgReturnsPerDay,
    profitFactor,
    avgDuration,
    startDate: firstTradeTime,
    lastUpdated: Date.now(),
  };
}

/**
 * Format performance metrics for console display
 * @param metrics - Performance metrics object
 * @param openTradesCount - Number of currently open trades (optional)
 * @returns Formatted string
 */
export function formatPerformanceReport(metrics: PerformanceMetrics, openTradesCount?: number): string {
  const daysSinceStart = (Date.now() - metrics.startDate) / (1000 * 60 * 60 * 24);
  const totalAllTrades = metrics.totalTrades + (openTradesCount ?? 0);
  const apyNote = metrics.apy === 0 && metrics.totalTrades < 5 && daysSinceStart < 3 
    ? ' (insufficient data)' 
    : '';
  
  return `
╔═══════════════════════════════════════════════════════════╗
║              📊 AGENT PERFORMANCE PROFILE                 ║
╚═══════════════════════════════════════════════════════════╝

  Trade Signal Metrics (Closed Trades Only)
  ─────────────────────────────────────────────────────────
  Total All Trades:          ${totalAllTrades} (${openTradesCount ?? 0} open, ${metrics.totalTrades} closed)
  Winning Trades:            ${metrics.winningTrades}
  Losing Trades:             ${metrics.losingTrades}
  Win Rate:                  ${metrics.winRate.toFixed(2)}%

  Performance Metrics
  ─────────────────────────────────────────────────────────
  APY:                       ${metrics.apy.toFixed(2)}%${apyNote}
  Total Return (2x lev):     ${metrics.totalReturnWithLeverage.toFixed(2)}%
  Total Return (no lev):     ${metrics.totalReturnWithoutLeverage.toFixed(2)}%
  Profit Factor:             ${metrics.profitFactor.toFixed(2)}
  
  Activity Metrics
  ─────────────────────────────────────────────────────────
  Avg Trades Per Day:        ${metrics.avgTradesPerDay.toFixed(1)}
  Avg Returns Per Day:       ${metrics.avgReturnsPerDay.toFixed(2)}%
  Avg Duration:              ${metrics.avgDuration.toFixed(1)}h
  Days Active:               ${daysSinceStart.toFixed(1)}

  Last Updated:              ${new Date(metrics.lastUpdated).toLocaleString()}

╔═══════════════════════════════════════════════════════════╗
`;
}

/**
 * Save performance metrics to database
 * @param metrics - Performance metrics object
 * @param openTradesCount - Number of currently open trades (optional, will be calculated if not provided)
 */
export async function savePerformanceMetrics(
  metrics: PerformanceMetrics,
  openTradesCount?: number
): Promise<void> {
  try {
    await ensureDbInitialized();
    
    // Sanitize all numeric values to prevent database overflow
    // Database uses NUMERIC(15,4), so max value is 99,999,999,999.9999
    const sanitize = (val: number): number => {
      if (!Number.isFinite(val)) return 0;
      return Math.max(-99999999999, Math.min(99999999999, val));
    };
    
    // Convert to database format
    const dbMetrics = {
      totalTrades: metrics.totalTrades,
      openTrades: openTradesCount ?? 0,
      closedTrades: metrics.totalTrades,
      winningTrades: metrics.winningTrades,
      losingTrades: metrics.losingTrades,
      winRate: sanitize(metrics.winRate),
      totalReturnPct: sanitize(metrics.totalReturnWithoutLeverage),
      totalReturnPctLeveraged: sanitize(metrics.totalReturnWithLeverage),
      avgTradeDurationHours: sanitize(metrics.avgDuration),
      profitFactor: sanitize(metrics.profitFactor),
      estimatedAPY: sanitize(metrics.apy),
      estimatedAPYLeveraged: sanitize(metrics.apy),
      lastUpdated: new Date(metrics.lastUpdated).toISOString(),
    };
    
    await dbSavePerformanceMetrics(dbMetrics);
    console.log(`[PERFORMANCE] Metrics saved to database`);
  } catch (error) {
    console.error(`[PERFORMANCE] Failed to save metrics to database:`, error);
    throw error;
  }
}

/**
 * Load performance metrics from database
 * @returns Performance metrics or null if not found
 */
export async function loadPerformanceMetrics(): Promise<PerformanceMetrics | null> {
  try {
    await ensureDbInitialized();
    const dbMetrics = await dbGetPerformanceMetrics();
    
    if (dbMetrics) {
      // Convert from database format
      return {
        totalTrades: dbMetrics.totalTrades,
        winningTrades: dbMetrics.winningTrades,
        losingTrades: dbMetrics.losingTrades,
        winRate: Number(dbMetrics.winRate),
        totalReturnWithLeverage: Number(dbMetrics.totalReturnPctLeveraged),
        totalReturnWithoutLeverage: Number(dbMetrics.totalReturnPct),
        apy: Number(dbMetrics.estimatedAPY),
        avgTradesPerDay: 0, // Can be calculated if needed
        avgReturnsPerDay: 0, // Can be calculated if needed
        profitFactor: Number(dbMetrics.profitFactor),
        avgDuration: Number(dbMetrics.avgTradeDurationHours),
        startDate: Date.now(), // Not stored in DB
        lastUpdated: new Date(dbMetrics.lastUpdated).getTime(),
      };
    }
    
    return null;
  } catch (error) {
    console.error(`[PERFORMANCE] Failed to load metrics from database:`, error);
    throw error;
  }
}

