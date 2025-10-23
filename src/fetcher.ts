// Fetch market data using Drift Protocol APIs

import axios from 'axios';
import { schedule } from './rate_limiter.js';
import { getMarketPrice as getCachedMarketPrice } from './market_cache.js';

// DLOB server (for orderbook/oracle snapshots) and Data API (for historical TWAPs)
const DRIFT_DLOB_BASE = process.env.DRIFT_BASE_URL || 'https://dlob.drift.trade';
const DRIFT_DATA_API_BASE = process.env.DRIFT_DATA_API_BASE || 'https://data.api.drift.trade';

/**
 * Interface for Drift OHLC candle data
 */
// Note: Drift does not expose a public REST candles endpoint. We approximate
// historical prices using oracle TWAPs from the Data API fundingRates endpoint.
interface FundingRateRecord {
  ts?: string; // ISO timestamp string (if available)
  slot?: number;
  oraclePriceTwap: string; // 1e6 precision
}

/**
 * Interface for Drift oracle price data
 */
// no-op placeholder removed

/**
 * Interface for pair price data
 */
export interface PairData {
  symbol: string;
  prices: number[];
  timestamps: number[];
}

/**
 * Fetches historical price series using oracle TWAPs from Drift Data API
 * @param marketName - Drift market name (e.g., 'SOL-PERP')
 * @param limit - Number of data points to fetch (default: 100)
 * @returns Array of prices and timestamps
 */
async function fetchOracleTwapSeries(
  marketName: string,
  limit: number = 100
): Promise<{ prices: number[]; timestamps: number[] }> {
  try {
    // Data API: GET /fundingRates?marketName=SOL-PERP
    // Use oraclePriceTwap (1e6 precision) as proxy for historical price
    // NOTE: API requires trailing slash in URL path
    const url = `${DRIFT_DATA_API_BASE}/fundingRates/`;
    const response = await schedule(() => axios.get(url, {
      params: { marketName: marketName },
      timeout: 15000,
    }));

    const records: FundingRateRecord[] = Array.isArray(response.data?.fundingRates)
      ? response.data.fundingRates
      : Array.isArray(response.data)
        ? response.data
        : [];

    if (!records || records.length === 0) {
      const err: any = new Error(`No fundingRates data returned for ${marketName}`);
      // Mark with a custom flag for upstream retry logic
      err.isNoData = true;
      throw err;
    }

    // Convert to prices (float) and timestamps
    const fullPrices = records
      .map((r) => Number(r.oraclePriceTwap) / 1e6)
      .filter((v) => Number.isFinite(v) && v > 0);

    // Build timestamps: prefer API 'ts' when present; otherwise synthesize 1h steps
    const tsFromApi: (number | undefined)[] = records.map((r) => (r.ts ? Date.parse(r.ts) : undefined));
    const fullTimestamps: number[] = new Array(records.length);
    const now = Date.now();
    for (let i = 0; i < records.length; i++) {
      if (typeof tsFromApi[i] === 'number' && Number.isFinite(tsFromApi[i])) {
        fullTimestamps[i] = tsFromApi[i] as number;
      } else {
        // assume hourly cadence
        fullTimestamps[i] = now - (records.length - 1 - i) * 3600_000;
      }
    }

    // Keep the most recent 'limit' points
    const start = Math.max(0, fullPrices.length - limit);
    const prices = fullPrices.slice(start);
    const timestamps = (fullTimestamps as number[]).slice(start);

    if (prices.length < Math.min(50, limit)) {
      const err: any = new Error(`Insufficient TWAP data for ${marketName}: got ${prices.length}`);
      err.isNoData = true;
      throw err;
    }

    return { prices, timestamps };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const err: any = new Error(
        `Failed to fetch TWAP series for ${marketName}: ${error.message}${status ? ` (status ${status})` : ''}`
      );
      // Attach HTTP status for callers to make decisions
      err.status = status;

      // Treat 403 (forbidden) as "no TWAP data available" rather than a generic client error
      if (status === 403) {
        err.isNoData = true;
        err.isClientError = false;
      } else {
        // Propagate client errors as non-retriable EXCEPT 429 (rate limit)
        const is4xx = !!status && status >= 400 && status < 500;
        err.isClientError = is4xx && status !== 429;
      }

      err.isRateLimited = status === 429;
      throw err;
    }
    throw error;
  }
}

/**
 * Fetches price data for a pair of Drift market indices
 * @param marketIndexA - First market index (e.g., 0 for SOL-PERP)
 * @param marketIndexB - Second market index (e.g., 1 for BTC-PERP)
 * @param symbolA - Symbol name for logging (e.g., 'SOL-PERP')
 * @param symbolB - Symbol name for logging (e.g., 'BTC-PERP')
 * @param limit - Number of data points to fetch
 * @returns Object containing data for both markets
 */
export async function fetchPairData(
  _marketIndexA: number, // kept for compatibility; not used with Data API
  _marketIndexB: number, // kept for compatibility; not used with Data API
  symbolA: string,
  symbolB: string,
  limit: number = 100
): Promise<{ dataA: PairData; dataB: PairData }> {
  try {
    // Fetch data for both markets in parallel
    const [resultA, resultB] = await Promise.all([
      fetchOracleTwapSeries(symbolA, limit),
      fetchOracleTwapSeries(symbolB, limit),
    ]);

    // Handle mismatched data lengths by trimming to the shorter length
    const minLength = Math.min(resultA.prices.length, resultB.prices.length);
    
    if (resultA.prices.length !== resultB.prices.length) {
      console.warn(
        `[FETCHER] Mismatched data lengths: ${symbolA}=${resultA.prices.length}, ${symbolB}=${resultB.prices.length}. Using ${minLength} data points.`
      );
    }

    // Validate we have enough data points for analysis
    if (minLength < 50) {
      throw new Error(
        `Insufficient data: only ${minLength} data points available (minimum 50 required)`
      );
    }

    return {
      dataA: {
        symbol: symbolA,
        prices: resultA.prices.slice(0, minLength),
        timestamps: resultA.timestamps.slice(0, minLength),
      },
      dataB: {
        symbol: symbolB,
        prices: resultB.prices.slice(0, minLength),
        timestamps: resultB.timestamps.slice(0, minLength),
      },
    };
  } catch (error) {
    // Downgrade expected 4xx/no-data issues to a concise warning to avoid noisy stack traces
    const isNoData = (error && (error as any).isNoData) === true;
    const isClientError = (error && (error as any).isClientError) === true;
    if (isNoData || isClientError) {
      console.warn(`[FETCHER] Skipping pair ${symbolA}/${symbolB}: ${
        (error as any)?.message ?? 'client/no-data error'
      }`);
    } else {
      console.error(`Error fetching pair data (${symbolA}/${symbolB}):`, error);
    }
    throw error;
  }
}

/**
 * Retry wrapper with exponential backoff
 * @param fn - Async function to retry
 * @param retries - Number of retry attempts
 * @param delay - Initial delay in ms
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
  // Do not retry on known client/no-data errors
    const clientErr = (error && (error as any).isClientError) === true;
    const noDataErr = (error && (error as any).isNoData) === true;
    const rateLimited = (error && (error as any).isRateLimited) === true;

    if (clientErr || noDataErr) {
      throw error;
    }

    if (retries === 0) throw error;
    
    const backoff = rateLimited ? Math.max(delay * 2, 1500) : delay;
    console.warn(`Retrying... (${retries} attempts left)${rateLimited ? ' [429 backoff]' : ''}`);
    await new Promise((resolve) => setTimeout(resolve, backoff));
    
    return withRetry(fn, retries - 1, delay * 2);
  }
}

/**
 * Fetch current oracle price for a Drift market
 * @param marketIndex - Market index (e.g., 0 for SOL-PERP)
 * @param symbol - Market symbol (e.g., 'SOL-PERP') - preferred method
 * @returns Current oracle price (scaled to decimal)
 */
export async function fetchCurrentPrice(marketIndex: number, symbol?: string): Promise<number> {
  try {
    // PREFER: Try DLOB L2 by marketName first (more reliable than marketIndex)
    if (symbol) {
      try {
        const l2 = await schedule(() => axios.get(`${DRIFT_DLOB_BASE}/l2`, {
          params: { marketName: symbol, includeOracle: true, depth: 1 },
          timeout: 8000,
        }).then(r => r.data));

        // Oracle prices from DLOB are in 1e6 precision (need to divide by 1,000,000)
        let oracleRaw = l2?.oracle ?? l2?.oracleData?.price;
        if (typeof oracleRaw === 'string') {
          oracleRaw = Number(oracleRaw);
        }
        
        if (typeof oracleRaw === 'number' && Number.isFinite(oracleRaw) && oracleRaw > 0) {
          const oraclePrice = oracleRaw / 1e6; // Convert from 1e6 precision to decimal
          return oraclePrice;
        }
      } catch (err) {
        // Continue to fallbacks
        console.log(`[FETCHER] DLOB fetch by symbol ${symbol} failed, trying fallbacks...`);
      }
    }

    // FALLBACK 1: Try DLOB L2 by marketIndex
    try {
      const l2 = await schedule(() => axios.get(`${DRIFT_DLOB_BASE}/l2`, {
        params: { marketIndex, includeOracle: true, depth: 1 },
        timeout: 8000,
      }).then(r => r.data));

      // Oracle prices from DLOB are in 1e6 precision
      let oracleRaw = l2?.oracle ?? l2?.oracleData?.price;
      if (typeof oracleRaw === 'string') {
        oracleRaw = Number(oracleRaw);
      }
      
      if (typeof oracleRaw === 'number' && Number.isFinite(oracleRaw) && oracleRaw > 0) {
        const oraclePrice = oracleRaw / 1e6; // Convert from 1e6 precision to decimal
        return oraclePrice;
      }
    } catch (err) {
      // Continue to next fallback
      console.log(`[FETCHER] DLOB fetch by marketIndex ${marketIndex} failed, trying fallbacks...`);
    }

    // FALLBACK 2: Data API fundingRates (TWAP)
    if (symbol) {
      const { prices } = await fetchOracleTwapSeries(symbol, 1);
      if (prices.length > 0 && prices[0] > 0) {
        return prices[0];
      }
    }

    // FALLBACK 3: Market cache (static prices from /stats/markets/prices)
    if (symbol) {
      const cached = await getCachedMarketPrice(symbol);
      if (typeof cached === 'number' && Number.isFinite(cached) && cached > 0) {
        return cached;
      }
    }

    throw new Error('All price sources unavailable');
  } catch (error) {
    console.error(`[FETCHER] Failed to fetch current price for ${symbol ?? `market ${marketIndex}`}:`, error);
    throw new Error(`Could not fetch price for ${symbol ?? `market ${marketIndex}`}`);
  }
}

/**
 * Fetch current oracle price by market symbol when index is unavailable.
 * Attempts DLOB /l2?marketName=symbol, then TWAP, then cached market price.
 * @returns Current oracle price (scaled to decimal)
 */
export async function fetchCurrentPriceBySymbol(symbol: string): Promise<number> {
  try {
    // Try DLOB by marketName
    const l2 = await schedule(() => axios.get(`${DRIFT_DLOB_BASE}/l2`, {
      params: { marketName: symbol, includeOracle: true, depth: 1 },
      timeout: 8000,
    }).then(r => r.data).catch(() => null));

    // Oracle prices from DLOB are in 1e6 precision (need to divide by 1,000,000)
    let oracleRaw = l2?.oracle ?? l2?.oracleData?.price;
    if (typeof oracleRaw === 'string') {
      oracleRaw = Number(oracleRaw);
    }
    
    if (typeof oracleRaw === 'number' && Number.isFinite(oracleRaw) && oracleRaw > 0) {
      const oraclePrice = oracleRaw / 1e6; // Convert from 1e6 precision to decimal
      return oraclePrice;
    }

    // Fallback to Data API TWAP (already returns decimal prices)
    const { prices } = await fetchOracleTwapSeries(symbol, 1);
    if (prices.length > 0 && prices[0] > 0) {
      return prices[0];
    }

    // Fallback to cached market price (already decimal)
    const cached = await getCachedMarketPrice(symbol);
    if (typeof cached === 'number' && Number.isFinite(cached) && cached > 0) {
      return cached;
    }

    throw new Error('All fallbacks failed');
  } catch (error) {
    console.error(`[FETCHER] Failed to fetch current price by symbol ${symbol}:`, error);
    throw new Error(`Could not fetch price for ${symbol}`);
  }
}

/**
 * Fetch current oracle prices for multiple Drift markets in batch
 * @param marketIndices - Array of market indices
 * @returns Map of market index to current price
 */
export async function fetchMultiplePrices(marketIndices: number[]): Promise<Record<number, number>> {
  try {
    // Fetch prices in parallel for each market
    const pricePromises = marketIndices.map(async (idx) => {
      const price = await fetchCurrentPrice(idx);
      return { idx, price };
    });

    const results = await Promise.all(pricePromises);
    
    const priceMap: Record<number, number> = {};
    results.forEach(({ idx, price }) => {
      priceMap[idx] = price;
    });

    return priceMap;
  } catch (error) {
    console.error(`[FETCHER] Failed to fetch multiple prices:`, error);
    throw new Error('Could not fetch prices for markets');
  }
}

/**
 * Quick availability check for TWAP history on a given market name.
 * Used to prefilter curated markets to avoid repeated 4xx/no-data errors.
 */
export async function hasTwapHistory(marketName: string, minPoints: number = 50): Promise<boolean> {
  try {
    const { prices } = await fetchOracleTwapSeries(marketName, minPoints);
    return prices.length >= minPoints;
  } catch (err) {
    return false;
  }
}
