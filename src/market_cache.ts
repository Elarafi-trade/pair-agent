// Dynamic market discovery and caching from Drift Protocol Data API

import axios from 'axios';
import { schedule } from './rate_limiter.js';

const DRIFT_DATA_API_BASE = process.env.DRIFT_DATA_API_BASE || 'https://data.api.drift.trade';

/**
 * Interface for Drift market price data from /stats/markets/prices
 */
export interface DriftMarketInfo {
  symbol: string;           // e.g., "SOL-PERP"
  currentPrice: string;     // Current price as string
  price24hAgo: string;      // Price 24 hours ago
  priceChange: string;      // Absolute price change
  priceChangePercent: string; // Percentage change
  marketIndex: number;      // Market index (0, 1, 2, ...)
  marketType: 'perp' | 'spot'; // Market type
}

/**
 * Response from /stats/markets/prices endpoint
 */
interface MarketsResponse {
  success: boolean;
  markets: DriftMarketInfo[];
}

/**
 * Cached market data
 */
let cachedMarkets: DriftMarketInfo[] | null = null;
let lastCacheTime: number = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Fetch all available markets from Drift Data API
 * Results are cached for 1 hour to minimize API calls
 * @param forceRefresh - Force refresh cache even if not expired
 * @returns Array of market info
 */
export async function fetchAllMarkets(forceRefresh: boolean = false): Promise<DriftMarketInfo[]> {
  const now = Date.now();
  
  // Return cached data if still valid
  if (!forceRefresh && cachedMarkets && (now - lastCacheTime) < CACHE_TTL_MS) {
    console.log(`[MARKET_CACHE] Using cached markets (${cachedMarkets.length} markets, age: ${Math.round((now - lastCacheTime) / 1000)}s)`);
    return cachedMarkets;
  }
  
  try {
    console.log(`[MARKET_CACHE] Fetching markets from ${DRIFT_DATA_API_BASE}/stats/markets/prices...`);
    
    const response = await schedule(() => 
      axios.get<MarketsResponse>(`${DRIFT_DATA_API_BASE}/stats/markets/prices`, {
        timeout: 10000,
      })
    );
    
    if (!response.data.success || !Array.isArray(response.data.markets)) {
      throw new Error('Invalid response from markets endpoint');
    }
    
    // Filter for perpetual markets only
    const perpMarkets = response.data.markets.filter(m => m.marketType === 'perp');
    
    // Update cache
    cachedMarkets = perpMarkets;
    lastCacheTime = now;
    
    console.log(`[MARKET_CACHE] Cached ${perpMarkets.length} perpetual markets`);
    console.log(`[MARKET_CACHE] Cache expires in ${Math.round(CACHE_TTL_MS / 1000 / 60)} minutes`);
    
    return perpMarkets;
  } catch (error: any) {
    console.error(`[MARKET_CACHE] Failed to fetch markets:`, error.message);
    
    // Return stale cache if available
    if (cachedMarkets) {
      console.log(`[MARKET_CACHE] Using stale cache (${cachedMarkets.length} markets)`);
      return cachedMarkets;
    }
    
    throw new Error(`Could not fetch markets from Drift API: ${error.message}`);
  }
}

/**
 * Get market info by symbol
 * @param symbol - Market symbol (e.g., 'SOL-PERP')
 * @returns Market info or undefined if not found
 */
export async function getMarketBySymbol(symbol: string): Promise<DriftMarketInfo | undefined> {
  const markets = await fetchAllMarkets();
  return markets.find(m => m.symbol === symbol);
}

/**
 * Get market info by index
 * @param marketIndex - Market index (0, 1, 2, ...)
 * @returns Market info or undefined if not found
 */
export async function getMarketByIndex(marketIndex: number): Promise<DriftMarketInfo | undefined> {
  const markets = await fetchAllMarkets();
  return markets.find(m => m.marketIndex === marketIndex);
}

/**
 * Get market index by symbol (reverse lookup)
 * @param symbol - Market symbol (e.g., 'SOL-PERP')
 * @returns Market index or undefined if not found
 */
export async function getMarketIndexBySymbol(symbol: string): Promise<number | undefined> {
  const market = await getMarketBySymbol(symbol);
  return market?.marketIndex;
}

/**
 * Get market symbol by index
 * @param marketIndex - Market index (0, 1, 2, ...)
 * @returns Market symbol or undefined if not found
 */
export async function getMarketSymbolByIndex(marketIndex: number): Promise<string | undefined> {
  const market = await getMarketByIndex(marketIndex);
  return market?.symbol;
}

/**
 * Get all perpetual market symbols
 * @returns Array of market symbols
 */
export async function getAllPerpSymbols(): Promise<string[]> {
  const markets = await fetchAllMarkets();
  return markets.map(m => m.symbol);
}

/**
 * Build symbol-to-index mapping (replaces hardcoded SYMBOL_TO_INDEX)
 * @returns Record mapping symbols to indices
 */
export async function buildSymbolToIndexMap(): Promise<Record<string, number>> {
  const markets = await fetchAllMarkets();
  const mapping: Record<string, number> = {};
  
  for (const market of markets) {
    mapping[market.symbol] = market.marketIndex;
  }
  
  return mapping;
}

/**
 * Build index-to-symbol mapping (replaces hardcoded INDEX_TO_SYMBOL)
 * @returns Record mapping indices to symbols
 */
export async function buildIndexToSymbolMap(): Promise<Record<number, string>> {
  const markets = await fetchAllMarkets();
  const mapping: Record<number, string> = {};
  
  for (const market of markets) {
    mapping[market.marketIndex] = market.symbol;
  }
  
  return mapping;
}

/**
 * Get current price for a market by symbol
 * Useful for quick price lookups without fetching orderbook
 * @param symbol - Market symbol (e.g., 'SOL-PERP')
 * @returns Current price as number or undefined if not found
 */
export async function getMarketPrice(symbol: string): Promise<number | undefined> {
  const market = await getMarketBySymbol(symbol);
  return market ? parseFloat(market.currentPrice) : undefined;
}

/**
 * Clear the market cache (useful for testing or forcing refresh)
 */
export function clearMarketCache(): void {
  cachedMarkets = null;
  lastCacheTime = 0;
  console.log('[MARKET_CACHE] Cache cleared');
}

/**
 * Get cache statistics
 * @returns Cache info
 */
export function getCacheStats(): { 
  isCached: boolean; 
  marketCount: number; 
  ageSeconds: number; 
  ttlSeconds: number;
} {
  return {
    isCached: cachedMarkets !== null,
    marketCount: cachedMarkets?.length ?? 0,
    ageSeconds: cachedMarkets ? Math.round((Date.now() - lastCacheTime) / 1000) : 0,
    ttlSeconds: Math.round(CACHE_TTL_MS / 1000),
  };
}
