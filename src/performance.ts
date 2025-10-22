// Agent performance metrics tracking

import { TradeRecord } from './executor.js';

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

  // Returns calculation (without leverage = sum of PnL %, with leverage = assume 10x)
  const totalReturnWithoutLeverage = closedTrades.reduce((sum, t) => sum + (t.closePnL ?? 0), 0);
  const totalReturnWithLeverage = totalReturnWithoutLeverage * 10; // Assume 10x leverage

  // Time-based metrics
  const firstTradeTime = Math.min(...closedTrades.map(t => t.timestamp));
  const lastTradeTime = Math.max(...closedTrades.map(t => t.closeTimestamp ?? t.timestamp));
  const totalDays = (lastTradeTime - firstTradeTime) / (1000 * 60 * 60 * 24);
  const avgTradesPerDay = totalDays > 0 ? totalTrades / totalDays : 0;

  // APY calculation: ((1 + total return)^(365/days) - 1) * 100
  const totalReturnDecimal = totalReturnWithLeverage / 100;
  const apy = totalDays > 0 
    ? (Math.pow(1 + totalReturnDecimal, 365 / totalDays) - 1) * 100
    : 0;

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
 * @returns Formatted string
 */
export function formatPerformanceReport(metrics: PerformanceMetrics): string {
  const daysSinceStart = (Date.now() - metrics.startDate) / (1000 * 60 * 60 * 24);
  
  return `
╔═══════════════════════════════════════════════════════════╗
║              📊 AGENT PERFORMANCE PROFILE                 ║
╚═══════════════════════════════════════════════════════════╝

  Trade Signal Metrics
  ─────────────────────────────────────────────────────────
  Total Trades:              ${metrics.totalTrades}
  Winning Trades:            ${metrics.winningTrades}
  Losing Trades:             ${metrics.losingTrades}
  Win Rate:                  ${metrics.winRate.toFixed(2)}%

  Performance Metrics
  ─────────────────────────────────────────────────────────
  APY:                       ${metrics.apy.toFixed(2)}%
  Total Return (10x lev):    ${metrics.totalReturnWithLeverage.toFixed(2)}%
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
 * Save performance metrics to file
 * @param metrics - Performance metrics object
 * @param filepath - Path to save file
 */
export async function savePerformanceMetrics(
  metrics: PerformanceMetrics,
  filepath: string = './performance.json'
): Promise<void> {
  try {
    const fs = await import('fs/promises');
    const data = JSON.stringify(metrics, null, 2);
    await fs.writeFile(filepath, data, 'utf-8');
    console.log(`[PERFORMANCE] Metrics saved to ${filepath}`);
  } catch (error) {
    console.error(`[PERFORMANCE] Failed to save metrics:`, error);
  }
}

/**
 * Load performance metrics from file
 * @param filepath - Path to metrics file
 * @returns Performance metrics or null if not found
 */
export async function loadPerformanceMetrics(
  filepath: string = './performance.json'
): Promise<PerformanceMetrics | null> {
  try {
    const fs = await import('fs/promises');
    const data = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(data) as PerformanceMetrics;
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      console.log(`[PERFORMANCE] No existing metrics found at ${filepath}`);
    } else {
      console.error(`[PERFORMANCE] Failed to load metrics:`, error);
    }
    return null;
  }
}
