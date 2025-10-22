// Copilot: Fetch the last 100 hourly klines for crypto pairs from Binance API

import axios from 'axios';

/**
 * Interface for Binance kline (candlestick) data
 */
interface BinanceKline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
}

/**
 * Interface for Binance ticker price response
 */
interface BinanceTickerPrice {
  symbol: string;
  price: string;
}

/**
 * Interface for pair price data
 */
export interface PairData {
  symbol: string;
  prices: number[];
  timestamps: number[];
}

/**
 * Fetches hourly candlestick data from Binance API
 * @param symbol - Trading pair symbol (e.g., 'BTCUSDT')
 * @param limit - Number of data points to fetch (default: 100)
 * @returns Array of closing prices
 */
async function fetchKlines(
  symbol: string,
  limit: number = 100
): Promise<{ prices: number[]; timestamps: number[] }> {
  const baseUrl = 'https://api.binance.com/api/v3/klines';
  
  try {
    const response = await axios.get(baseUrl, {
      params: {
        symbol,
        interval: '1h',
        limit,
      },
      timeout: 10000,
    });

    const klines: BinanceKline[] = response.data.map((k: any[]) => ({
      openTime: k[0],
      open: k[1],
      high: k[2],
      low: k[3],
      close: k[4],
      volume: k[5],
      closeTime: k[6],
    }));

    // Extract closing prices and timestamps
    const prices = klines.map((k) => parseFloat(k.close));
    const timestamps = klines.map((k) => k.closeTime);

    return { prices, timestamps };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to fetch data for ${symbol}: ${error.message}`
      );
    }
    throw error;
  }
}

/**
 * Fetches price data for a pair of trading symbols
 * @param pairA - First trading symbol (e.g., 'BTCUSDT')
 * @param pairB - Second trading symbol (e.g., 'ETHUSDT')
 * @param limit - Number of data points to fetch
 * @returns Object containing data for both pairs
 */
export async function fetchPairData(
  pairA: string,
  pairB: string,
  limit: number = 100
): Promise<{ dataA: PairData; dataB: PairData }> {
  try {
    // Fetch data for both pairs in parallel
    const [resultA, resultB] = await Promise.all([
      fetchKlines(pairA, limit),
      fetchKlines(pairB, limit),
    ]);

    // Handle mismatched data lengths by trimming to the shorter length
    const minLength = Math.min(resultA.prices.length, resultB.prices.length);
    
    if (resultA.prices.length !== resultB.prices.length) {
      console.warn(
        `[FETCHER] Mismatched data lengths: ${pairA}=${resultA.prices.length}, ${pairB}=${resultB.prices.length}. Using ${minLength} data points.`
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
        symbol: pairA,
        prices: resultA.prices.slice(0, minLength),
        timestamps: resultA.timestamps.slice(0, minLength),
      },
      dataB: {
        symbol: pairB,
        prices: resultB.prices.slice(0, minLength),
        timestamps: resultB.timestamps.slice(0, minLength),
      },
    };
  } catch (error) {
    console.error(`Error fetching pair data (${pairA}/${pairB}):`, error);
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
    if (retries === 0) throw error;
    
    console.warn(`Retrying... (${retries} attempts left)`);
    await new Promise((resolve) => setTimeout(resolve, delay));
    
    return withRetry(fn, retries - 1, delay * 2);
  }
}

/**
 * Fetch current price for a single symbol using Binance ticker API
 * @param symbol - Trading pair symbol (e.g., 'BTCUSDC')
 * @returns Current price
 */
export async function fetchCurrentPrice(symbol: string): Promise<number> {
  try {
    const response = await axios.get<BinanceTickerPrice>(
      `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`,
      { timeout: 10000 }
    );
    return parseFloat(response.data.price);
  } catch (error) {
    console.error(`[FETCHER] Failed to fetch current price for ${symbol}:`, error);
    throw new Error(`Could not fetch price for ${symbol}`);
  }
}

/**
 * Fetch current prices for multiple symbols in batch
 * @param symbols - Array of trading pair symbols
 * @returns Map of symbol to current price
 */
export async function fetchMultiplePrices(symbols: string[]): Promise<Record<string, number>> {
  try {
    const symbolsParam = JSON.stringify(symbols);
    const response = await axios.get<BinanceTickerPrice[]>(
      `https://api.binance.com/api/v3/ticker/price?symbols=${symbolsParam}`,
      { timeout: 10000 }
    );
    
    const priceMap: Record<string, number> = {};
    response.data.forEach((item) => {
      priceMap[item.symbol] = parseFloat(item.price);
    });
    
    return priceMap;
  } catch (error) {
    console.error(`[FETCHER] Failed to fetch multiple prices:`, error);
    throw new Error('Could not fetch prices for symbols');
  }
}
