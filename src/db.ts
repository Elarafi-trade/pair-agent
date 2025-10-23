/**
 * Database client for Neon Serverless Postgres (Backend)
 * Handles trade records and performance metrics storage
 */

import { neon } from '@neondatabase/serverless';

// Get database URL from environment
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set. Please create .env file with your Neon connection string.');
}

const sql = neon(process.env.DATABASE_URL);

export interface TradeRecord {
  id?: number;
  timestamp: string;
  pair: string;
  action: string;
  signal: string;
  zScore: number;
  correlation: number;
  spread: number;
  spreadMean: number;
  spreadStd: number;
  beta: number;
  reason: string;
  longAsset: string;
  shortAsset: string;
  longPrice: number;
  shortPrice: number;
  status: 'open' | 'closed';
  closeTimestamp?: string;
  closeReason?: string;
  closePnL?: number;
  upnlPct?: number;
  volatility?: number;
  halfLife?: number;
  sharpe?: number;
}

export interface PerformanceMetrics {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalReturnPct: number;
  totalReturnPctLeveraged: number;
  avgTradeDurationHours: number;
  profitFactor: number;
  estimatedAPY: number;
  estimatedAPYLeveraged: number;
  lastUpdated: string;
}

/**
 * Initialize database tables if they don't exist
 */
export async function initializeTables() {
  try {
    // Create trades table
    await sql`
      CREATE TABLE IF NOT EXISTS trades (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL,
        pair VARCHAR(50) NOT NULL,
        action VARCHAR(50) NOT NULL,
        signal TEXT NOT NULL,
        z_score DECIMAL(10, 4) NOT NULL,
        correlation DECIMAL(10, 4) NOT NULL,
        spread DECIMAL(20, 8) NOT NULL,
        spread_mean DECIMAL(20, 8) NOT NULL,
        spread_std DECIMAL(20, 8) NOT NULL,
        beta DECIMAL(10, 4) NOT NULL,
        reason TEXT NOT NULL,
        long_asset VARCHAR(20) NOT NULL,
        short_asset VARCHAR(20) NOT NULL,
        long_price DECIMAL(20, 8) NOT NULL,
        short_price DECIMAL(20, 8) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        close_timestamp TIMESTAMPTZ,
        close_reason TEXT,
        close_pnl DECIMAL(10, 4),
        upnl_pct DECIMAL(10, 4),
        volatility DECIMAL(10, 4),
        half_life DECIMAL(10, 4),
        sharpe DECIMAL(10, 4),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // Create performance_metrics table
    await sql`
      CREATE TABLE IF NOT EXISTS performance_metrics (
        id SERIAL PRIMARY KEY,
        total_trades INTEGER NOT NULL,
        open_trades INTEGER NOT NULL,
        closed_trades INTEGER NOT NULL,
        winning_trades INTEGER NOT NULL,
        losing_trades INTEGER NOT NULL,
        win_rate DECIMAL(10, 4) NOT NULL,
        total_return_pct DECIMAL(15, 4) NOT NULL,
        total_return_pct_leveraged DECIMAL(15, 4) NOT NULL,
        avg_trade_duration_hours DECIMAL(10, 2) NOT NULL,
        profit_factor DECIMAL(15, 4) NOT NULL,
        estimated_apy DECIMAL(15, 4) NOT NULL,
        estimated_apy_leveraged DECIMAL(15, 4) NOT NULL,
        last_updated TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    console.log('[DB] Tables initialized successfully');
  } catch (error) {
    console.error('[DB] Error initializing tables:', error);
    throw error;
  }
}

/**
 * Insert a new trade record
 */
export async function insertTrade(trade: TradeRecord): Promise<number> {
  const result = await sql`
    INSERT INTO trades (
      timestamp, pair, action, signal, z_score, correlation, spread,
      spread_mean, spread_std, beta, reason, long_asset, short_asset,
      long_price, short_price, status, upnl_pct, volatility, half_life, sharpe
    ) VALUES (
      ${trade.timestamp}, ${trade.pair}, ${trade.action}, ${trade.signal},
      ${trade.zScore}, ${trade.correlation}, ${trade.spread},
      ${trade.spreadMean}, ${trade.spreadStd}, ${trade.beta}, ${trade.reason},
      ${trade.longAsset}, ${trade.shortAsset}, ${trade.longPrice}, ${trade.shortPrice},
      ${trade.status}, ${trade.upnlPct || 0}, ${trade.volatility || 0},
      ${trade.halfLife || 0}, ${trade.sharpe || 0}
    )
    RETURNING id
  `;
  
  return result[0].id;
}

/**
 * Update trade when closed
 */
export async function closeTrade(
  id: number,
  closeTimestamp: string,
  closeReason: string,
  closePnL: number
) {
  await sql`
    UPDATE trades
    SET status = 'closed',
        close_timestamp = ${closeTimestamp},
        close_reason = ${closeReason},
        close_pnl = ${closePnL}
    WHERE id = ${id}
  `;
}

/**
 * Update unrealized PnL for open trade
 */
export async function updateTradePnL(id: number, upnlPct: number) {
  await sql`
    UPDATE trades
    SET upnl_pct = ${upnlPct}
    WHERE id = ${id}
  `;
}

/**
 * Get all trades (latest 100)
 */
export async function getAllTrades(): Promise<TradeRecord[]> {
  const result = await sql`
    SELECT 
      id,
      timestamp,
      pair,
      action,
      signal,
      z_score as "zScore",
      correlation,
      spread,
      spread_mean as "spreadMean",
      spread_std as "spreadStd",
      beta,
      reason,
      long_asset as "longAsset",
      short_asset as "shortAsset",
      long_price as "longPrice",
      short_price as "shortPrice",
      status,
      close_timestamp as "closeTimestamp",
      close_reason as "closeReason",
      close_pnl as "closePnL",
      upnl_pct as "upnlPct",
      volatility,
      half_life as "halfLife",
      sharpe
    FROM trades
    ORDER BY timestamp DESC
    LIMIT 100
  `;
  
  return result as TradeRecord[];
}

/**
 * Get open trades only
 */
export async function getOpenTrades(): Promise<TradeRecord[]> {
  const result = await sql`
    SELECT 
      id,
      timestamp,
      pair,
      action,
      signal,
      z_score as "zScore",
      correlation,
      spread,
      spread_mean as "spreadMean",
      spread_std as "spreadStd",
      beta,
      reason,
      long_asset as "longAsset",
      short_asset as "shortAsset",
      long_price as "longPrice",
      short_price as "shortPrice",
      status,
      upnl_pct as "upnlPct",
      volatility,
      half_life as "halfLife",
      sharpe
    FROM trades
    WHERE status = 'open'
    ORDER BY timestamp DESC
  `;
  
  return result as TradeRecord[];
}

/**
 * Get closed trades only
 */
export async function getClosedTrades(): Promise<TradeRecord[]> {
  const result = await sql`
    SELECT 
      id,
      timestamp,
      pair,
      action,
      signal,
      z_score as "zScore",
      correlation,
      spread,
      spread_mean as "spreadMean",
      spread_std as "spreadStd",
      beta,
      reason,
      long_asset as "longAsset",
      short_asset as "shortAsset",
      long_price as "longPrice",
      short_price as "shortPrice",
      status,
      close_timestamp as "closeTimestamp",
      close_reason as "closeReason",
      close_pnl as "closePnL",
      volatility,
      half_life as "halfLife",
      sharpe
    FROM trades
    WHERE status = 'closed'
    ORDER BY timestamp DESC
  `;
  
  return result as TradeRecord[];
}

/**
 * Save performance metrics (upsert latest record)
 * 
 * Strategy: Keep only the latest performance metrics record by deleting all old ones
 * before inserting the new one. This ensures:
 * - Single source of truth for current performance
 * - No accumulation of historical snapshots
 * - Clean database state
 */
export async function savePerformanceMetrics(metrics: PerformanceMetrics) {
  // Delete all existing performance metrics (we only keep the latest)
  await sql`DELETE FROM performance_metrics`;
  
  // Insert new record
  await sql`
    INSERT INTO performance_metrics (
      total_trades, open_trades, closed_trades, winning_trades, losing_trades,
      win_rate, total_return_pct, total_return_pct_leveraged,
      avg_trade_duration_hours, profit_factor, estimated_apy,
      estimated_apy_leveraged, last_updated
    ) VALUES (
      ${metrics.totalTrades}, ${metrics.openTrades}, ${metrics.closedTrades},
      ${metrics.winningTrades}, ${metrics.losingTrades}, ${metrics.winRate},
      ${metrics.totalReturnPct}, ${metrics.totalReturnPctLeveraged},
      ${metrics.avgTradeDurationHours}, ${metrics.profitFactor},
      ${metrics.estimatedAPY}, ${metrics.estimatedAPYLeveraged},
      ${metrics.lastUpdated}
    )
  `;
}

/**
 * Get latest performance metrics
 */
export async function getPerformanceMetrics(): Promise<PerformanceMetrics | null> {
  const result = await sql`
    SELECT 
      total_trades as "totalTrades",
      open_trades as "openTrades",
      closed_trades as "closedTrades",
      winning_trades as "winningTrades",
      losing_trades as "losingTrades",
      win_rate as "winRate",
      total_return_pct as "totalReturnPct",
      total_return_pct_leveraged as "totalReturnPctLeveraged",
      avg_trade_duration_hours as "avgTradeDurationHours",
      profit_factor as "profitFactor",
      estimated_apy as "estimatedAPY",
      estimated_apy_leveraged as "estimatedAPYLeveraged",
      last_updated as "lastUpdated"
    FROM performance_metrics
    ORDER BY created_at DESC
    LIMIT 1
  `;
  
  if (result.length === 0) {
    return null;
  }
  
  return result[0] as PerformanceMetrics;
}
